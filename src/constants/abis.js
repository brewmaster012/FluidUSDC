export const CURVE_POOL_ABI = [
  "function balances(uint256) view returns (uint256)",
  "function get_virtual_price() view returns (uint256)",
  "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy, address receiver) returns (uint256)",
  "function add_liquidity(uint256[] memory amounts, uint256 min_mint_amount, address receiver) returns (uint256)",
  "function remove_liquidity_one_coin(uint256 burn_amount, int128 i, uint256 min_received, address receiver) returns (uint256)",
  "function calc_withdraw_one_coin(uint256 burn_amount, int128 i) view returns (uint256)",
];

export const ZRC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function transfer(address, uint256) returns (bool)",
  "function withdraw(bytes memory to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function transfer(address, uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const GATEWAY_ABI = [
  "function deposit(address receiver, uint256 amount, address asset, tuple(bool callOnRevert, bytes revertMessage) revertOptions) external",
  "function depositAndCall(address receiver, uint256 amount, address asset, bytes payload, tuple(address revertAddress, bool callOnRevert, address abortAddress, bytes revertMessage, uint256 onRevertGasLimit) revertOptions) external",
];

export const WITHDRAWER_ABI = [
  "function withdrawToChain(uint256 targetChainId, bytes memory recipient, uint256 amount, uint256 minAmountOut, uint256 maxSwapAmount) external",
  "function getUSDCForChain(uint256 chainId) public view returns (address)",
];
