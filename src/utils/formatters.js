import { ethers } from "ethers";

export function formatUnits(balance, decimals) {
  return balance
    ? Number(ethers.utils.formatUnits(balance, decimals)).toLocaleString(
        undefined,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )
    : "0.00";
}
