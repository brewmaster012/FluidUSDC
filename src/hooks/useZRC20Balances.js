import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ADDRESSES, CHAIN_IDS } from "../constants/addresses";
import { ZRC20_ABI } from "../constants/abis";

export function useZRC20Balances(account, provider, refreshTrigger = 0) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("useZRC20Balances");
    console.log("accoutn", account);
    if (!account || !provider) {
      setBalances([]);
      return;
    }

    const fetchBalances = async () => {
      console.log("fetching balances...");
      try {
        setLoading(true);

        // Define ZRC20 tokens to check
        const tokens = [
          {
            address: ADDRESSES.ZETA.USDC_POOL,
            symbol: "USDC.4",
            name: "USDC 4-pool LP Token",
            network: "ZetaChain",
            chainId: CHAIN_IDS.ZETA,
          },
          {
            address: ADDRESSES.ZETA.USDC_ARB,
            symbol: "USDC.ARB",
            name: "USDC from Arbitrum",
            network: "Arbitrum",
            chainId: CHAIN_IDS.ARBITRUM,
          },
          {
            address: ADDRESSES.ZETA.USDC_SOL,
            symbol: "USDC.SOL",
            name: "USDC from Solana",
            network: "Solana",
            chainId: "solana", // Not an EVM chain
          },
          {
            address: ADDRESSES.ZETA.USDC_BASE,
            symbol: "USDC.BASE",
            name: "USDC from Base",
            network: "Base",
            chainId: CHAIN_IDS.BASE,
          },
          {
            address: ADDRESSES.ZETA.USDC_AVAX,
            symbol: "USDC.AVAX",
            name: "USDC from Avalanche",
            network: "Avalanche",
            chainId: CHAIN_IDS.AVAX,
          },
        ];

        const results = await Promise.all(
          tokens.map(async (token) => {
            try {
              const contract = new ethers.Contract(
                token.address,
                ZRC20_ABI,
                provider,
              );

              const balance = await contract.balanceOf(account);
              const decimals = await contract.decimals();

              return {
                ...token,
                balance,
                formattedBalance: parseFloat(
                  ethers.utils.formatUnits(balance, decimals),
                ),
                decimals,
              };
            } catch (err) {
              console.error(`Error fetching balance for ${token.symbol}:`, err);
              return {
                ...token,
                balance: ethers.BigNumber.from(0),
                formattedBalance: 0,
                decimals: 18,
                error: err.message,
              };
            }
          }),
        );

        // Sort balances: non-zero balances first, then alphabetically
        const sortedBalances = results.sort((a, b) => {
          // First sort by whether balance is zero
          if (a.formattedBalance > 0 && b.formattedBalance === 0) return -1;
          if (a.formattedBalance === 0 && b.formattedBalance > 0) return 1;

          // Then sort alphabetically by symbol
          return a.symbol.localeCompare(b.symbol);
        });

        setBalances(sortedBalances);
      } catch (err) {
        console.error("Error fetching ZRC20 balances:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [account, provider, refreshTrigger]);

  return { balances, loading, error };
}
