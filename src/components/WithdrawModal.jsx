// src/components/WithdrawModal.jsx
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { ADDRESSES, CHAIN_IDS } from "../constants/addresses";
import { ZRC20_ABI } from "../constants/abis";
import NetworkIcon from "./NetworkIcon";

const WITHDRAWER_ABI = [
  "function withdrawToChain(uint256 targetChainId, bytes memory recipient, uint256 amount, uint256 minAmountOut, uint256 maxSwapAmount) external",
  "function getUSDCForChain(uint256 chainId) public view returns (address)",
];

// Replace with your actual contract address
const WITHDRAWER_ADDRESS = ADDRESSES.ZETA.USDC4_WITHDRAWER;

// Status mapping for UI display
const STATUS_MESSAGES = {
  pending: "Transaction submitted",
  confirming: "Confirming transaction on ZetaChain",
  processing: "Processing cross-chain transfer",
  outboundMined: "Completed on destination chain",
  failed: "Transaction failed",
};

// Network explorer URLs for transactions
const NETWORK_EXPLORERS = {
  [CHAIN_IDS.ARBITRUM]: "https://arbiscan.io/tx/",
  [CHAIN_IDS.BASE]: "https://basescan.org/tx/",
  [CHAIN_IDS.AVAX]: "https://snowtrace.io/tx/",
  zeta: "https://zetachain.blockscout.com/tx/",
};

const WithdrawModal = ({ isOpen, onClose, token, onSuccess }) => {
  const { signer } = useWallet();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetChain, setTargetChain] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [slippage, setSlippage] = useState(5.0); // Increased default slippage to 5%
  const [gasSwapRatio, setGasSwapRatio] = useState(10); // Increased default gas ratio to 10%

  // New state variables for transaction tracking
  const [txStatus, setTxStatus] = useState(null); // null, 'pending', 'confirming', 'processing', 'outboundMined', 'failed'
  const [zetaTxHash, setZetaTxHash] = useState(null);
  const [externalTxHash, setExternalTxHash] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);

  useEffect(() => {
    // Reset state when modal opens or token changes
    setAmount("");
    setTargetChain("");
    setRecipientAddress("");
    setError(null);
    setTxStatus(null);
    setZetaTxHash(null);
    setExternalTxHash(null);

    // Clear any existing intervals
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }
  }, [isOpen, token]);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [statusCheckInterval]);

  const handleMaxClick = () => {
    if (token) {
      setAmount(token.formattedBalance.toString());
    }
  };

  const validateAddress = (address) => {
    try {
      ethers.utils.getAddress(address); // Will throw if not valid
      return true;
    } catch (error) {
      return false;
    }
  };

  // New function to check transaction status
  const checkTransactionStatus = async (txHash) => {
    try {
      const response = await fetch(
        `https://zetachain.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${txHash}`,
      );

      if (!response.ok) {
        console.error(
          "Error fetching transaction status:",
          await response.text(),
        );
        return null;
      }

      const data = await response.json();
      console.log("Transaction status data:", data);

      if (!data.CrossChainTxs || data.CrossChainTxs.length === 0) {
        return null;
      }

      const tx = data.CrossChainTxs[0];

      // Check if outbound transaction exists and has been mined
      if (tx.outbound_params && tx.outbound_params.length > 0) {
        const outbound = tx.outbound_params[0];

        if (tx.cctx_status.status === "OutboundMined") {
          // Transaction completed on the target chain
          setTxStatus("outboundMined");
          setExternalTxHash(outbound.hash);

          // Clear the interval as we've reached the final state
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            setStatusCheckInterval(null);
          }

          onSuccess?.();
        } else if (outbound.tx_finalization_status === "Executed") {
          // Transaction is being processed on the target chain
          setTxStatus("processing");
          setExternalTxHash(outbound.hash);
        } else {
          // Still waiting for the transaction to be processed
          setTxStatus("confirming");
        }
      }

      return tx;
    } catch (error) {
      console.error("Error checking transaction status:", error);
      return null;
    }
  };

  const handleWithdraw = async () => {
    if (!signer || !token || !amount || !targetChain || !recipientAddress)
      return;

    if (!validateAddress(recipientAddress)) {
      setError("Invalid recipient address");
      return;
    }

    setLoading(true);
    setError(null);
    setTxStatus("pending");

    try {
      const parsedAmount = ethers.utils.parseUnits(
        amount.toString(),
        token.decimals,
      );

      // Calculate a more conservative minAmountOut with higher slippage
      const minAmountOut = parsedAmount
        .mul(0)
        // .mul(100 - Math.floor(slippage * 100))
        .div(100);

      // Calculate a more generous maxSwapAmount for gas
      const maxSwapAmount = parsedAmount;

      // Encode recipient address as bytes
      const encodedRecipient = ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [recipientAddress],
      );

      // First approve the withdrawer contract to spend tokens
      const tokenContract = new ethers.Contract(
        token.address,
        ZRC20_ABI,
        signer,
      );

      // Check current allowance before approving
      const currentAllowance = await tokenContract.allowance(
        await signer.getAddress(),
        WITHDRAWER_ADDRESS,
      );

      // Only approve if needed
      if (currentAllowance.lt(parsedAmount)) {
        console.log("Approving withdrawer to spend tokens...");
        const approveTx = await tokenContract.approve(
          WITHDRAWER_ADDRESS,
          parsedAmount,
        );

        console.log("Waiting for approval transaction...");
        await approveTx.wait();
        console.log("Approval transaction confirmed");
      } else {
        console.log("Approval not needed - current allowance is sufficient");
      }

      // Now call the withdrawer contract
      const withdrawerContract = new ethers.Contract(
        WITHDRAWER_ADDRESS,
        WITHDRAWER_ABI,
        signer,
      );

      console.log("Calling withdrawToChain with params:", {
        targetChainId: parseInt(targetChain),
        recipient: recipientAddress,
        amount: ethers.utils.formatUnits(parsedAmount, token.decimals),
        minAmountOut: ethers.utils.formatUnits(minAmountOut, token.decimals),
        maxSwapAmount: ethers.utils.formatUnits(maxSwapAmount, token.decimals),
      });

      const tx = await withdrawerContract.withdrawToChain(
        parseInt(targetChain),
        encodedRecipient,
        parsedAmount,
        minAmountOut,
        maxSwapAmount,
      );

      console.log("Waiting for withdrawal transaction...");
      setZetaTxHash(tx.hash);
      setTxStatus("confirming");

      await tx.wait();
      console.log("Withdrawal transaction confirmed on ZetaChain");

      // Start polling for transaction status
      const intervalId = setInterval(async () => {
        await checkTransactionStatus(tx.hash);
      }, 10000); // Check every 10 seconds

      setStatusCheckInterval(intervalId);

      // Check once immediately
      await checkTransactionStatus(tx.hash);
    } catch (err) {
      console.error("Withdrawal failed:", err);
      setTxStatus("failed");

      // Extract and display a more helpful error message
      let errorMessage = "Withdrawal failed";
      if (err.message.includes("Not enough coins removed")) {
        errorMessage =
          "Not enough coins removed. Try increasing the slippage tolerance or gas allocation percentage.";
      } else if (err.data?.message) {
        errorMessage = `Error: ${err.data.message}`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Function to render transaction status UI
  const renderTransactionStatus = () => {
    if (!txStatus) return null;

    return (
      <div className="mt-4 border rounded-md p-4 bg-gray-50">
        <h3 className="font-medium mb-2">Transaction Status</h3>

        <div className="flex items-center mb-2">
          <div
            className={`w-3 h-3 rounded-full mr-2 ${
              txStatus === "failed"
                ? "bg-red-500"
                : txStatus === "outboundMined"
                  ? "bg-green-500"
                  : "bg-yellow-500"
            }`}
          ></div>
          <span>{STATUS_MESSAGES[txStatus] || "Unknown status"}</span>
        </div>

        {zetaTxHash && (
          <div className="text-sm mt-2">
            <p>ZetaChain Transaction:</p>
            <a
              href={`${NETWORK_EXPLORERS.zeta}${zetaTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {zetaTxHash}
            </a>
          </div>
        )}

        {externalTxHash && (
          <div className="text-sm mt-2">
            <p>Destination Chain Transaction:</p>
            <a
              href={`${NETWORK_EXPLORERS[targetChain]}${externalTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {externalTxHash}
            </a>
          </div>
        )}

        {txStatus !== "outboundMined" && txStatus !== "failed" && (
          <p className="text-sm text-gray-500 mt-2">
            Cross-chain transactions may take several minutes to complete. This
            status will update automatically.
          </p>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Withdraw USDC.4 to External Chain
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {token && (
          <div className="mb-4">
            {/* Only show form if we're not already tracking a transaction */}
            {!txStatus || txStatus === "failed" ? (
              <>
                <div className="flex items-center mb-2">
                  <NetworkIcon network={token.network} />
                  <div className="ml-2">
                    <span className="font-medium">{token.symbol}</span>
                    <span className="text-sm text-gray-500 ml-1">
                      Balance: {token.formattedBalance.toFixed(6)}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      disabled={loading}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={handleMaxClick}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Chain
                  </label>
                  <select
                    value={targetChain}
                    onChange={(e) => setTargetChain(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={loading}
                  >
                    <option value="">Select a chain</option>
                    <option value={CHAIN_IDS.ARBITRUM}>Arbitrum</option>
                    <option value={CHAIN_IDS.BASE}>Base</option>
                    <option value={CHAIN_IDS.AVAX}>Avalanche</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="0x..."
                    disabled={loading}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slippage Tolerance (higher = more likely to succeed)
                  </label>
                  <select
                    value={slippage}
                    onChange={(e) => setSlippage(parseFloat(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={loading}
                  >
                    <option value="1.0">1.0%</option>
                    <option value="3.0">3.0%</option>
                    <option value="5.0">5.0%</option>
                    <option value="10.0">10.0%</option>
                    <option value="15.0">15.0%</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gas Fee Allocation (higher = more likely to succeed)
                  </label>
                  <select
                    value={gasSwapRatio}
                    onChange={(e) =>
                      setGasSwapRatio(parseFloat(e.target.value))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={loading}
                  >
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                    <option value="20">20%</option>
                  </select>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                    {error}
                  </div>
                )}

                <div className="mt-6">
                  <button
                    onClick={handleWithdraw}
                    disabled={
                      !amount || !targetChain || !recipientAddress || loading
                    }
                    className={`w-full py-2 px-4 rounded-md ${
                      !amount || !targetChain || !recipientAddress || loading
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {loading ? "Processing..." : "Withdraw to External Chain"}
                  </button>
                </div>

                <div className="mt-4 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                  <p className="text-yellow-800 text-sm">
                    <strong>Note:</strong> If your transaction fails with "Not
                    enough coins removed" error, try:
                    <ul className="list-disc ml-5 mt-1">
                      <li>Increasing the slippage tolerance</li>
                      <li>Increasing the gas fee allocation</li>
                      <li>Using a smaller withdrawal amount</li>
                    </ul>
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center p-4">
                <h3 className="font-medium text-lg mb-3">
                  Cross-Chain Transfer in Progress
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your withdrawal is being processed. This transaction requires
                  confirmation on both ZetaChain and the destination network.
                </p>

                {/* Show a different button based on transaction status */}
                {txStatus === "outboundMined" ? (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Complete ✓
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (statusCheckInterval) {
                        clearInterval(statusCheckInterval);
                      }
                      setTxStatus(null);
                      setZetaTxHash(null);
                      setExternalTxHash(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Make Another Withdrawal
                  </button>
                )}
              </div>
            )}

            {/* Always show transaction status if available */}
            {renderTransactionStatus()}
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
