import React from "react";
import { useWallet } from "../hooks/useWallet";
import { CHAIN_IDS } from "../constants/addresses";

const chainNames = {
  [CHAIN_IDS.ZETA]: "ZetaChain",
  [CHAIN_IDS.ARBITRUM]: "Arbitrum",
  [CHAIN_IDS.BASE]: "Base",
  [CHAIN_IDS.AVAX]: "Avalanche",
};

const WalletConnect = () => {
  const {
    account,
    chainId,
    connecting,
    error,
    connectWallet,
    switchToChain,
    isConnected,
  } = useWallet();

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
      {isConnected ? (
        <>
          <div className="flex items-center space-x-2">
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              Connected: {account.slice(0, 6)}...{account.slice(-4)}
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              {chainNames[chainId] || `Chain ID: ${chainId}`}
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => switchToChain(CHAIN_IDS.ZETA)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
            >
              Switch to ZetaChain
            </button>
            <button
              onClick={() => switchToChain(CHAIN_IDS.ARBITRUM)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              Switch to Arbitrum
            </button>
          </div>
        </>
      ) : (
        <div className="w-full flex justify-center">
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        </div>
      )}

      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  );
};

export default WalletConnect;
