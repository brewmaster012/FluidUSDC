import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "../constants/addresses";
import { CURVE_POOL_ABI, ZRC20_ABI } from "../constants/abis";

export function usePoolData() {
  const [poolData, setPoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPoolData() {
      try {
        setLoading(true);

        // Connect to ZetaChain
        const provider = new ethers.providers.JsonRpcProvider(
          "https://zetachain-evm.blockpi.network/v1/rpc/public",
        );

        // Initialize pool contract
        const poolContract = new ethers.Contract(
          ADDRESSES.ZETA.USDC_POOL,
          CURVE_POOL_ABI,
          provider,
        );

        // Initialize ZRC20 tokens
        const tokens = [
          { address: ADDRESSES.ZETA.USDC_ARB, symbol: "USDC.ARB" },
          { address: ADDRESSES.ZETA.USDC_SOL, symbol: "USDC.SOL" },
          { address: ADDRESSES.ZETA.USDC_BASE, symbol: "USDC.BASE" },
          { address: ADDRESSES.ZETA.USDC_AVAX, symbol: "USDC.AVAX" },
        ];

        // Fetch balances and other data
        const virtualPriceRaw = await poolContract.get_virtual_price();
        const virtualPrice = parseFloat(
          ethers.utils.formatUnits(virtualPriceRaw, 18),
        );

        const assets = await Promise.all(
          tokens.map(async (token, i) => {
            const tokenContract = new ethers.Contract(
              token.address,
              ZRC20_ABI,
              provider,
            );
            const decimals = await tokenContract.decimals();
            const balance = await poolContract.balances(i);

            return {
              ...token,
              decimals,
              balance,
              usdValue: parseFloat(ethers.utils.formatUnits(balance, decimals)),
            };
          }),
        );

        // Calculate total liquidity and percentages
        const totalLiquidity = assets.reduce(
          (sum, asset) => sum + asset.usdValue,
          0,
        );

        const assetsWithPercentage = assets.map((asset) => ({
          ...asset,
          percentage: (asset.usdValue / totalLiquidity) * 100,
        }));

        setPoolData({
          totalLiquidity,
          virtualPrice,
          assets: assetsWithPercentage,
        });
      } catch (err) {
        console.error("Error fetching pool data:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPoolData();
  }, []);

  return { poolData, loading, error };
}
