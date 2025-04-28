// Update ZRC20Balances.jsx
import React, { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { useZRC20Balances } from "../hooks/useZRC20Balances";
import { CHAIN_IDS } from "../constants/addresses";
import NetworkIcon from "./NetworkIcon";
import ConversionModal from "./ConversionModal";

const ZRC20Balances = () => {
  const { account, provider, chainId, switchToChain } = useWallet();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { balances, loading, error } = useZRC20Balances(
    account,
    provider,
    refreshTrigger,
  );
  const [modalState, setModalState] = useState({
    isOpen: false,
    token: null,
    mode: null,
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    console.log("handleRefresh");
    setRefreshTrigger((prev) => prev + 1);
  };

  const openConvertModal = (token) => {
    setModalState({
      isOpen: true,
      token,
      mode: "convert",
    });
  };

  const openRedeemModal = (token) => {
    setModalState({
      isOpen: true,
      token,
      mode: "redeem",
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      token: null,
      mode: null,
    });
  };

  const handleConversionSuccess = () => {
    // Refresh balances after a successful conversion
    handleRefresh();
  };

  const isZetaChain = chainId === CHAIN_IDS.ZETA;

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Your ZRC20 Balances</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100"
          title="Refresh balances"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {!isZetaChain && (
          <button
            onClick={() => switchToChain(CHAIN_IDS.ZETA)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
          >
            Switch to ZetaChain
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4">
          <svg
            className="animate-spin h-6 w-6 mx-auto text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="mt-2 text-gray-500">Loading balances...</p>
        </div>
      ) : error ? (
        <div className="text-red-500 p-4 text-center">
          Error loading balances: {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Token
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Balance
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Source
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {balances.map((token, index) => (
                <tr
                  key={token.address}
                  className={token.formattedBalance > 0 ? "bg-green-50" : ""}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <NetworkIcon network={token.network} />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {token.symbol}
                        </div>
                        <div className="text-xs text-gray-500">
                          {token.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {token.formattedBalance.toFixed(
                        token.formattedBalance > 0 ? 6 : 2,
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {token.network}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {token.formattedBalance > 0 &&
                      token.symbol !== "USDC.4" && (
                        <button
                          onClick={() => openConvertModal(token)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          Convert to USDC.4
                        </button>
                      )}
                    {token.formattedBalance > 0 &&
                      token.symbol === "USDC.4" && (
                        <button
                          onClick={() => openRedeemModal(token)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          Redeem
                        </button>
                      )}
                  </td>
                </tr>
              ))}

              {balances.length === 0 && (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No ZRC20 balances found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <p>
          Note: Balances are shown for tokens on ZetaChain only. Switch to
          ZetaChain to see your balances.
        </p>
      </div>

      {/* Conversion Modal */}
      <ConversionModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        token={modalState.token}
        mode={modalState.mode}
        onSuccess={handleConversionSuccess}
      />
    </div>
  );
};

export default ZRC20Balances;
