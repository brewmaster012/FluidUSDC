// Updated src/hooks/useWallet.js
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CHAIN_IDS } from "../constants/addresses";

// Network metadata for better error messages
const NETWORK_NAMES = {
  [CHAIN_IDS.ZETA]: "ZetaChain",
  [CHAIN_IDS.ARBITRUM]: "Arbitrum",
  [CHAIN_IDS.BASE]: "Base",
  [CHAIN_IDS.AVAX]: "Avalanche",
  [CHAIN_IDS.SOLANA]: "Solana",
};

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [networkSwitching, setNetworkSwitching] = useState(false);

  // Initialize provider more safely
  const initializeProvider = useCallback(() => {
    if (!window.ethereum) return null;

    try {
      return new ethers.providers.Web3Provider(window.ethereum, "any"); // "any" helps with network changes
    } catch (err) {
      console.error("Error initializing provider:", err);
      return null;
    }
  }, []);

  // Reset connection state
  const resetConnection = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
  }, []);

  // Update the current connection details
  const updateConnectionDetails = useCallback(async (web3Provider) => {
    if (!web3Provider) return;

    try {
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setChainId(network.chainId);
      setError(null);
    } catch (err) {
      console.error("Error updating connection details:", err);
      setError(`Connection error: ${err.message}`);
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError(
        "No Ethereum wallet found. Please install MetaMask or another wallet.",
      );
      return;
    }

    try {
      setConnecting(true);
      setError(null);

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const web3Provider = initializeProvider();

      if (!web3Provider) {
        throw new Error("Failed to initialize provider");
      }

      await updateConnectionDetails(web3Provider);
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError(`Failed to connect: ${err.message}`);
      resetConnection();
    } finally {
      setConnecting(false);
    }
  };

  const switchToChain = async (targetChainId) => {
    if (!window.ethereum || !provider) return;

    try {
      setNetworkSwitching(true);
      setError(null);

      // Format chain ID as hex
      const chainIdHex = `0x${targetChainId.toString(16)}`;

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });

      // Wait for the network to update
      const web3Provider = initializeProvider();
      if (web3Provider) {
        // Force a refresh of network information
        const network = await web3Provider.getNetwork();

        // Verify the switch was successful
        if (network.chainId !== targetChainId) {
          throw new Error(
            `Network switch failed. Expected ${NETWORK_NAMES[targetChainId] || targetChainId}, got ${network.chainId}`,
          );
        }

        await updateConnectionDetails(web3Provider);
      }
    } catch (error) {
      console.error("Error switching chain:", error);

      // Handle "chain not added" error
      if (error.code === 4902) {
        setError(
          `The ${NETWORK_NAMES[targetChainId] || targetChainId} network needs to be added to your wallet`,
        );
      } else {
        setError(`Network switch error: ${error.message}`);
      }
    } finally {
      setNetworkSwitching(false);
    }
  };

  const switchToZetaChain = () => switchToChain(CHAIN_IDS.ZETA);

  // Listen for account and network changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        // Re-initialize provider and signer on account change
        const web3Provider = initializeProvider();
        if (web3Provider) {
          updateConnectionDetails(web3Provider);
        }
      } else {
        resetConnection();
      }
    };

    const handleChainChanged = (chainIdHex) => {
      // When chain changes, we need to completely refresh the provider
      const numericChainId = parseInt(chainIdHex, 16);
      setChainId(numericChainId);

      // Re-initialize provider
      const web3Provider = initializeProvider();
      if (web3Provider) {
        updateConnectionDetails(web3Provider);
      }
    };

    const handleConnect = () => {
      // Check connection when wallet connects
      const web3Provider = initializeProvider();
      if (web3Provider) {
        updateConnectionDetails(web3Provider);
      }
    };

    const handleDisconnect = (error) => {
      console.log("Wallet disconnected", error);
      resetConnection();
      setError("Wallet disconnected");
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("connect", handleConnect);
    window.ethereum.on("disconnect", handleDisconnect);

    // Check initial connection state
    const checkInitialConnection = async () => {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          const web3Provider = initializeProvider();
          if (web3Provider) {
            await updateConnectionDetails(web3Provider);
          }
        }
      } catch (err) {
        console.error("Error checking initial connection:", err);
      }
    };

    checkInitialConnection();

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
      window.ethereum.removeListener("connect", handleConnect);
      window.ethereum.removeListener("disconnect", handleDisconnect);
    };
  }, [initializeProvider, updateConnectionDetails, resetConnection]);

  return {
    account,
    provider,
    signer,
    chainId,
    connecting,
    networkSwitching,
    error,
    connectWallet,
    switchToChain,
    switchToZetaChain,
    isConnected: !!account,
  };
}
