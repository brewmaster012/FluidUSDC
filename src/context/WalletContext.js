// src/context/WalletContext.js
import React, { createContext, useContext } from "react";
import { useWallet as useWalletHook } from "../hooks/useWallet";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const walletState = useWalletHook();

  return (
    <WalletContext.Provider value={walletState}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === null) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
