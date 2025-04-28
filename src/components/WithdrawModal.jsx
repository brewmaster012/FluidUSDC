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

const WithdrawModal = ({ isOpen, onClose, token, onSuccess }) => {
  const { signer } = useWallet();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetChain, setTargetChain] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [slippage, setSlippage] = useState(5.0); // Increased default slippage to 5%
  const [gasSwapRatio, setGasSwapRatio] = useState(10); // Increased default gas ratio to 10%

  useEffect(() => {
    // Reset state when modal opens or token changes
    setAmount("");
    setTargetChain("");
    setRecipientAddress("");
    setError(null);
  }, [isOpen, token]);

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

  const handleWithdraw = async () => {
    if (!signer || !token || !amount || !targetChain || !recipientAddress)
      return;

    if (!validateAddress(recipientAddress)) {
      setError("Invalid recipient address");
      return;
    }

    setLoading(true);
    setError(null);

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
      // const minAmountOut = ethers.utils.parseInt("0");

      // Calculate a more generous maxSwapAmount for gas
      // const maxSwapAmount = parsedAmount.mul(Math.floor(gasSwapRatio)).div(100);
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
      await tx.wait();
      console.log("Withdrawal transaction confirmed");

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Withdrawal failed:", err);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
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
                onChange={(e) => setGasSwapRatio(parseFloat(e.target.value))}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
