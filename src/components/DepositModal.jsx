// Updated DepositModal.jsx with enhanced network switching

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { ADDRESSES, CHAIN_IDS } from "../constants/addresses";
import { GATEWAY_ABI, ERC20_ABI } from "../constants/abis";
import NetworkIcon from "./NetworkIcon";

// The address of the deployed USDC4Converter contract
const CONVERTER_ADDRESS = ADDRESSES.ZETA.USDC4_CONVERTER;

// Status mapping for UI display
const STATUS_MESSAGES = {
  pending: "Transaction submitted",
  confirming: "Confirming on source chain",
  processing: "Processing on ZetaChain",
  outboundMined: "Completed on ZetaChain",
  failed: "Transaction failed",
};

// Network explorer URLs for transactions
const NETWORK_EXPLORERS = {
  [CHAIN_IDS.ARBITRUM]: "https://arbiscan.io",
  [CHAIN_IDS.BASE]: "https://basescan.org",
  [CHAIN_IDS.AVAX]: "https://snowtrace.io",
  zeta: "https://zetachain.blockscout.com",
};

// Network->USDC mapping
const NETWORK_USDC = {
  [CHAIN_IDS.ARBITRUM]: {
    gateway: ADDRESSES.ARBITRUM.GATEWAY,
    usdc: ADDRESSES.ARBITRUM.USDC,
    name: "Arbitrum",
    color: "bg-blue-600 hover:bg-blue-700",
    iconColor: "rgb(40, 160, 240)",
  },
  [CHAIN_IDS.BASE]: {
    gateway: ADDRESSES.BASE.GATEWAY,
    usdc: ADDRESSES.BASE.USDC,
    name: "Base",
    color: "bg-blue-800 hover:bg-blue-900",
    iconColor: "rgb(0, 82, 255)",
  },
  [CHAIN_IDS.AVAX]: {
    gateway: ADDRESSES.AVAX.GATEWAY,
    usdc: ADDRESSES.AVAX.USDC,
    name: "Avalanche",
    color: "bg-red-600 hover:bg-red-700",
    iconColor: "rgb(232, 65, 66)",
  },
};

const DepositModal = ({ isOpen, onClose, onSuccess }) => {
  const { signer, account, chainId, switchToChain } = useWallet();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recipientAddress, setRecipientAddress] = useState("");

  // Transaction status tracking
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);

  // states tracking cctx
  const [zetaTxHash, setZetaTxHash] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setRecipientAddress(account || "");
      setError(null);
      setTxStatus(null);
      setTxHash(null);
      setZetaTxHash(null);
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
    }
  }, [isOpen, account]);

  useEffect(() => {
    return () => {
      if (statusCheckInterval) clearInterval(statusCheckInterval);
    };
  }, [statusCheckInterval]);

  const checkDepositStatus = async (sourceTxHash) => {
    try {
      const response = await fetch(
        `https://zetachain.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${sourceTxHash}`,
      );
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      if (!data.CrossChainTxs?.length) return null;

      const cctx = data.CrossChainTxs[0];
      if (cctx.outbound_params?.length) {
        const outbound = cctx.outbound_params[0];
        if (outbound.hash) setZetaTxHash(outbound.hash);

        if (cctx.cctx_status.status === "OutboundMined") {
          setTxStatus("outboundMined");
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
          onSuccess?.();
        } else {
          setTxStatus(
            outbound.tx_finalization_status === "Executed"
              ? "processing"
              : "confirming",
          );
        }
      }
      return cctx;
    } catch (error) {
      console.error("Error checking deposit status:", error);
      return null;
    }
  };

  // Check if we're on a supported chain
  const isOnSupportedChain = NETWORK_USDC[chainId] !== undefined;
  const currentNetwork = isOnSupportedChain ? NETWORK_USDC[chainId] : null;

  const getUsdcBalance = async () => {
    if (!isOnSupportedChain || !signer) return "0";

    try {
      const usdcAddress = NETWORK_USDC[chainId].usdc;
      const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
      const balance = await usdcContract.balanceOf(account);
      const decimals = await usdcContract.decimals();
      return ethers.utils.formatUnits(balance, decimals);
    } catch (err) {
      console.error("Error fetching USDC balance:", err);
      return "0";
    }
  };

  const [usdcBalance, setUsdcBalance] = useState("0");

  useEffect(() => {
    if (isOpen && isOnSupportedChain) {
      getUsdcBalance().then((balance) => setUsdcBalance(balance));
    }
  }, [isOpen, chainId, account, isOnSupportedChain]);

  const handleMaxClick = () => {
    setAmount(usdcBalance);
  };

  const NetworkButton = ({ network, chainIdValue }) => {
    const isActive = chainId === chainIdValue;
    const networkInfo = NETWORK_USDC[chainIdValue];

    return (
      <button
        onClick={() => switchToChain(chainIdValue)}
        disabled={isActive}
        className={`py-2 px-3 rounded-md flex items-center justify-center ${
          isActive
            ? "bg-gray-200 cursor-default border-2 border-gray-400"
            : `${networkInfo.color} text-white`
        }`}
      >
        <div className="flex items-center">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center mr-2"
            style={{ backgroundColor: networkInfo.iconColor }}
          >
            <span className="text-white text-xs font-bold">
              {networkInfo.name.charAt(0)}
            </span>
          </div>
          <span>{networkInfo.name}</span>
        </div>
      </button>
    );
  };

  const handleDeposit = async () => {
    if (!signer || !amount || !recipientAddress || !isOnSupportedChain) return;

    setLoading(true);
    setError(null);
    setTxStatus("preparing");

    try {
      const network = NETWORK_USDC[chainId];
      const networkInfo = NETWORK_USDC[chainId];
      const usdcContract = new ethers.Contract(network.usdc, ERC20_ABI, signer);
      const gatewayContract = new ethers.Contract(
        network.gateway,
        GATEWAY_ABI,
        signer,
      );

      const decimals = await usdcContract.decimals();
      const parsedAmount = ethers.utils.parseUnits(amount, decimals);

      // First approve gateway to spend USDC
      const currentAllowance = await usdcContract.allowance(
        account,
        networkInfo.gateway,
      );

      if (currentAllowance.lt(parsedAmount)) {
        setTxStatus("approving");
        const approveTx = await usdcContract.approve(
          network.gateway,
          parsedAmount,
        );
        await approveTx.wait();
      } else {
        console.log(`allowance ${currentAllowance} enough; skip approve tx`);
      }

      // Deposit transaction
      setTxStatus("depositing");
      // Prepare payload for the USDC4Converter contract
      // The payload should encode the recipient address that will receive USDC.4
      const payload = ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [recipientAddress],
      );

      // Set up revert options
      const revertOptions = {
        revertAddress: account, // Address to receive reverted funds
        callOnRevert: false,
        abortAddress: account, // Address to receive funds if aborted
        revertMessage: "0x", // Empty revert message
        onRevertGasLimit: 100000, // 100K gas limit for revert
      };

      // Call depositAndCall on the gateway
      const tx = await gatewayContract.depositAndCall(
        CONVERTER_ADDRESS, // Receiver (USDC4Converter contract)
        parsedAmount, // Amount of USDC
        network.usdc, // USDC token address
        payload, // Encoded recipient address
        revertOptions, // Revert options
      );

      setTxHash(tx.hash);
      setTxStatus("confirming");

      await tx.wait();

      const interval = setInterval(() => checkDepositStatus(tx.hash), 10000);
      setStatusCheckInterval(interval);
      await checkDepositStatus(tx.hash);

      // Call success callback
      // onSuccess?.();

      // Don't close the modal yet - let user see the completion status
    } catch (err) {
      console.error("Deposit failed:", err);
      setTxStatus("failed");

      let errorMessage = "Transaction failed";
      if (err.data?.message) {
        errorMessage = `Error: ${err.data.message}`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderTransactionStatus = () => {
    if (!txStatus) return null;

    const statusMap = {
      preparing: "Preparing transaction...",
      approving: "Approving USDC spending...",
      depositing: "Initiating cross-chain deposit...",
      confirming: "Confirming transaction...",
      complete:
        "Deposit successful! USDC.4 will be received on ZetaChain shortly.",
      failed: "Transaction failed",
    };

    return (
      <div className="mt-4 border rounded-md p-4 bg-gray-50">
        <h3 className="font-medium mb-2">Transaction Status</h3>

        <div className="flex items-center mb-2">
          <div
            className={`w-3 h-3 rounded-full mr-2 ${
              txStatus === "failed"
                ? "bg-red-500"
                : txStatus === "complete"
                  ? "bg-green-500"
                  : "bg-yellow-500"
            }`}
          ></div>
          <span>{statusMap[txStatus] || "Processing..."}</span>
        </div>

        {txHash && (
          <div className="text-sm mt-2">
            <p>Transaction Hash:</p>
            <a
              href={`https://${
                chainId === CHAIN_IDS.ARBITRUM
                  ? "arbiscan.io"
                  : chainId === CHAIN_IDS.BASE
                    ? "basescan.org"
                    : "snowtrace.io"
              }/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {txHash}
            </a>
          </div>
        )}

        {zetaTxHash && (
          <div className="text-sm mt-2">
            <p>ZetaChain Transaction:</p>
            <a
              href={`${NETWORK_EXPLORERS.zeta}/tx/${zetaTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {zetaTxHash}
            </a>
          </div>
        )}
        {txStatus === "outboundMined" ? (
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Transaction Complete
          </button>
        ) : (
          txStatus === "failed" && (
            <button
              onClick={() => {
                setTxStatus(null);
                setTxHash(null);
                setZetaTxHash(null);
              }}
              className="w-full mt-4 py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Try Again
            </button>
          )
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Deposit USDC to ZetaChain</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Network switcher - always visible */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Select Network:</p>
          <div className="grid grid-cols-3 gap-2">
            <NetworkButton
              network="Arbitrum"
              chainIdValue={CHAIN_IDS.ARBITRUM}
            />
            <NetworkButton network="Base" chainIdValue={CHAIN_IDS.BASE} />
            <NetworkButton network="Avalanche" chainIdValue={CHAIN_IDS.AVAX} />
          </div>
        </div>

        {!isOnSupportedChain ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
            <p className="text-yellow-800">
              Please select one of the supported networks above to deposit USDC.
            </p>
          </div>
        ) : (
          <div className="mb-4">
            {!txStatus || txStatus === "failed" ? (
              <>
                <div className="flex items-center mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <NetworkIcon network={currentNetwork.name} />
                  <div className="ml-2">
                    <span className="font-medium">
                      USDC on {currentNetwork.name}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">
                      Balance: {parseFloat(usdcBalance).toFixed(6)}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount to Deposit
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
                    Recipient Address (will receive USDC.4 on ZetaChain)
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="0x..."
                    disabled={loading}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This address will receive USDC.4 tokens on ZetaChain
                  </p>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                    {error}
                  </div>
                )}

                <div className="mt-6">
                  <button
                    onClick={handleDeposit}
                    disabled={!amount || !recipientAddress || loading}
                    className={`w-full py-2 px-4 rounded-md ${
                      !amount || !recipientAddress || loading
                        ? "bg-gray-300 cursor-not-allowed"
                        : currentNetwork.color + " text-white"
                    }`}
                  >
                    {loading
                      ? "Processing..."
                      : `Deposit USDC from ${currentNetwork.name} to ZetaChain`}
                  </button>
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-md">
                  <p className="text-blue-800 text-sm">
                    <strong>Note:</strong> This will deposit USDC from{" "}
                    {currentNetwork.name} to ZetaChain and automatically convert
                    it to USDC.4. Cross-chain transfers typically take 3-10
                    minutes to complete.
                  </p>
                </div>
              </>
            ) : null}

            {/* Always show transaction status if available */}
            {renderTransactionStatus()}
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositModal;
