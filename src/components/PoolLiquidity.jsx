import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { usePoolData } from "../hooks/usePoolData";
import { formatUnits } from "../utils/formatters";

const PoolLiquidity = () => {
  const { poolData, loading, error } = usePoolData();

  if (loading)
    return <div className="p-4 text-center">Loading pool data...</div>;
  if (error)
    return (
      <div className="p-4 text-center text-red-500">Error: {error.message}</div>
    );

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">USDC.4 Pool Liquidity</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Liquidity</h3>
          <p className="text-3xl font-bold">
            ${poolData?.totalLiquidity.toFixed(2)}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Virtual Price</h3>
          <p className="text-3xl font-bold">
            ${poolData?.virtualPrice.toFixed(6)}
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2">Asset Composition</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {poolData?.assets.map((asset, index) => (
          <div key={index} className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">{asset.symbol}</p>
            <p className="text-xl font-bold">
              {formatUnits(asset.balance, asset.decimals)}
            </p>
            <p className="text-sm text-gray-600">
              ${asset.usdValue.toFixed(2)} ({asset.percentage.toFixed(1)}%)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PoolLiquidity;
