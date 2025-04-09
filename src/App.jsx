import React from "react";
import WalletConnect from "./components/WalletConnect";
import PoolLiquidity from "./components/PoolLiquidity";

const App = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <h1 className="text-2xl font-bold text-purple-800 mb-4 md:mb-0">
              FluidUSDC
            </h1>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Cross-Chain USDC Solution</h2>
          <p className="text-gray-700">
            FluidUSDC enables seamless transfer of USDC between Arbitrum,
            Solana, Base, and Avalanche through ZetaChain, with minimal slippage
            and gas costs.
          </p>
        </div>

        <PoolLiquidity />

        {/* More components will be added here as we build them */}
      </main>

      <footer className="bg-gray-800 text-white py-6">
        <div className="container mx-auto px-4 text-center">
          <p>USE THIS AT YOUR OWN RISK!!</p>
          <p className="mt-2 text-gray-400">
            FluidUSDC is an experimental application built on ZetaChain.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
