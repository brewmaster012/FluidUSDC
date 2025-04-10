import React from "react";

const NetworkIcon = ({ network }) => {
  const getNetworkColor = (network) => {
    switch (network.toLowerCase()) {
      case "zetachain":
        return "rgb(130, 71, 229)"; // Purple
      case "arbitrum":
        return "rgb(40, 160, 240)"; // Blue
      case "solana":
        return "rgb(20, 241, 149)"; // Green
      case "base":
        return "rgb(0, 82, 255)"; // Dark Blue
      case "avalanche":
        return "rgb(232, 65, 66)"; // Red
      default:
        return "rgb(130, 130, 130)"; // Gray
    }
  };

  const getInitial = (network) => {
    return network.charAt(0).toUpperCase();
  };

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
      style={{ backgroundColor: getNetworkColor(network) }}
    >
      {getInitial(network)}
    </div>
  );
};

export default NetworkIcon;
