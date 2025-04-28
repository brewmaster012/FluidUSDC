// src/components/ConversionModal.jsx
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { ADDRESSES } from "../constants/addresses";
import { CURVE_POOL_ABI, ZRC20_ABI } from "../constants/abis";
import NetworkIcon from "./NetworkIcon";

const ConversionModal = ({
  isOpen,
  onClose,
  token,
  mode, // 'convert' or 'redeem'
  onSuccess,
}) => {
  const { signer } = useWallet();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetToken, setTargetToken] = useState(null);
  const [slippage, setSlippage] = useState(0.5); // 0.5% default slippage

  useEffect(() => {
    // Reset state when modal opens or token changes
    setAmount("");
    setError(null);
  }, [isOpen, token]);

  const handleMaxClick = () => {
    if (token) {
      setAmount(token.formattedBalance.toString());
    }
  };

  const handleConvert = async () => {
    if (!signer || !token || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const parsedAmount = ethers.utils.parseUnits(
        amount.toString(),
        token.decimals,
      );

      // Get token contract
      const tokenContract = new ethers.Contract(
        token.address,
        ZRC20_ABI,
        signer,
      );

      // Get pool contract
      const poolContract = new ethers.Contract(
        ADDRESSES.ZETA.USDC_POOL,
        CURVE_POOL_ABI,
        signer,
      );

      if (mode === "convert") {
        // First approve the pool to spend tokens
        const approveTx = await tokenContract.approve(
          ADDRESSES.ZETA.USDC_POOL,
          parsedAmount,
        );
        await approveTx.wait();

        // Prepare add_liquidity parameters
        // We need an array with zeros and our amount at the correct index
        const tokenIndexMap = {
          "USDC.ARB": 0,
          "USDC.SOL": 1,
          "USDC.BASE": 2,
          "USDC.AVAX": 3,
        };

        const tokenIndex = tokenIndexMap[token.symbol];
        const amounts = [0, 0, 0, 0];
        amounts[tokenIndex] = parsedAmount;

        // Calculate min amount with slippage
        const minMintAmount = parsedAmount
          .mul(100 - Math.floor(slippage * 100))
          .div(100);

        // Add liquidity to get USDC.4
        const tx = await poolContract.add_liquidity(
          amounts,
          minMintAmount,
          signer.getAddress(),
        );
        await tx.wait();
      } else if (mode === "redeem") {
        // For redeem, we need to use remove_liquidity_one_coin
        // First approve the pool to spend USDC.4
        const approveTx = await tokenContract.approve(
          ADDRESSES.ZETA.USDC_POOL,
          parsedAmount,
        );
        await approveTx.wait();

        // Get target token index
        const tokenIndexMap = {
          "USDC.ARB": 0,
          "USDC.SOL": 1,
          "USDC.BASE": 2,
          "USDC.AVAX": 3,
        };

        const tokenIndex = tokenIndexMap[targetToken];

        // Calculate expected output for slippage calculation
        const expectedOutput = await poolContract.calc_withdraw_one_coin(
          parsedAmount,
          tokenIndex,
        );

        // Apply slippage tolerance
        const minReceived = expectedOutput
          .mul(100 - Math.floor(slippage * 100))
          .div(100);

        // Remove liquidity to get target token
        const tx = await poolContract.remove_liquidity_one_coin(
          parsedAmount,
          tokenIndex,
          minReceived,
          signer.getAddress(),
        );
        await tx.wait();
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(err.message || "Transaction failed");
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
            {mode === "convert" ? "Convert to USDC.4" : "Redeem USDC.4"}
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

            {mode === "redeem" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redeem to
                </label>
                <select
                  value={targetToken || ""}
                  onChange={(e) => setTargetToken(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                >
                  <option value="">Select a token</option>
                  <option value="USDC.ARB">USDC.ARB (Arbitrum)</option>
                  <option value="USDC.SOL">USDC.SOL (Solana)</option>
                  <option value="USDC.BASE">USDC.BASE (Base)</option>
                  <option value="USDC.AVAX">USDC.AVAX (Avalanche)</option>
                </select>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slippage Tolerance
              </label>
              <select
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading}
              >
                <option value="0.1">0.1%</option>
                <option value="0.5">0.5%</option>
                <option value="1.0">1.0%</option>
                <option value="2.0">2.0%</option>
              </select>
            </div>

            {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}

            <div className="mt-6">
              <button
                onClick={handleConvert}
                disabled={
                  !amount || loading || (mode === "redeem" && !targetToken)
                }
                className={`w-full py-2 px-4 rounded-md ${
                  !amount || loading || (mode === "redeem" && !targetToken)
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {loading
                  ? "Processing..."
                  : mode === "convert"
                    ? "Convert to USDC.4"
                    : "Redeem USDC.4"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversionModal;
