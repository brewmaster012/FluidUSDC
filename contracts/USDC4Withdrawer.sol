// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
}

interface ICurvePool {
    function remove_liquidity_one_coin(
        uint256 _burn_amount,
        int128 i,
        uint256 _min_received,
        address _receiver
    ) external returns (uint256);
}

interface IZRC20 {
    function withdrawGasFee() external view returns (address, uint256);

    function withdraw(bytes memory to, uint256 amount) external returns (bool);
}

interface ISystem {
    function gasZetaPoolByChainId(
        uint256 chainId
    ) external view returns (address);

    function uniswapv2FactoryAddress() external view returns (address);

    function uniswapv2Router02Address() external view returns (address);

    function wZetaContractAddress() external view returns (address);
}

interface IUniswapV2Router {
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsIn(
        uint amountOut,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

contract USDC4Withdrawer {
    address public constant USDC4_POOL =
        0xCA4b0396064F40640F1d9014257a99aB3336C724;
    address public constant USDC_ARB =
        0x0327f0660525b15Cdb8f1f5FBF0dD7Cd5Ba182aD;
    address public constant USDC_SOL =
        0x8344d6f84d26f998fa070BbEA6D2E15E359e2641;
    address public constant USDC_BASE =
        0x96152E6180E085FA57c7708e18AF8F05e37B479D;
    address public constant USDC_AVAX =
        0xa52Ad01A1d62b408fFe06C2467439251da61E4a9;
    address public constant SYSTEM_CONTRACT =
        0x91d18e54DAf4F677cB28167158d6dd21F6aB3921;

    mapping(address => int128) public coinIndices;
    mapping(uint256 => address) public chainToUSDC;

    constructor() {
        // Initialize the coin indices for the Curve pool
        coinIndices[USDC_ARB] = 0;
        coinIndices[USDC_SOL] = 1;
        coinIndices[USDC_BASE] = 2;
        coinIndices[USDC_AVAX] = 3;

        // Initialize chain ID to USDC mapping
        chainToUSDC[42161] = USDC_ARB; // Arbitrum
        chainToUSDC[8453] = USDC_BASE; // Base
        chainToUSDC[43114] = USDC_AVAX; // Avalanche
    }

    /**
     * @dev Withdraws USDC.4 to a specific chain, swapping some USDC.X for gas automatically
     * @param targetChainId Chain ID of the target network
     * @param recipient Recipient address on the target chain (encoded as bytes)
     * @param amount Amount of USDC.4 to withdraw
     * @param minAmountOut Minimum amount of USDC.X to receive from the Curve pool
     * @param maxSwapAmount Maximum amount of USDC.X to swap for gas (for slippage protection)
     */
    function withdrawToChain(
        uint256 targetChainId,
        bytes memory recipient,
        uint256 amount,
        uint256 minAmountOut,
        uint256 maxSwapAmount
    ) external {
        // Get the appropriate USDC.X for the target chain
        address usdcXAddress = chainToUSDC[targetChainId];
        require(usdcXAddress != address(0), "Unsupported chain");

        // Transfer USDC.4 from user to this contract
        require(
            IERC20(USDC4_POOL).transferFrom(msg.sender, address(this), amount),
            "USDC.4 transfer failed"
        );

        // Convert USDC.4 to USDC.X
        int128 coinIndex = coinIndices[usdcXAddress];

        // Approve the USDC.4 pool to spend our USDC.4 tokens
        IERC20(USDC4_POOL).approve(USDC4_POOL, amount);

        // Remove liquidity from the pool to get USDC.X
        uint256 usdcXAmount = ICurvePool(USDC4_POOL).remove_liquidity_one_coin(
            amount,
            coinIndex,
            minAmountOut,
            address(this)
        );

        // Get gas fee information
        (address gasZRC20, uint256 gasFee) = IZRC20(usdcXAddress)
            .withdrawGasFee();

        // Swap some USDC.X for the gas token
        uint256 swappedAmount = swapForGasToken(
            usdcXAddress,
            gasZRC20,
            gasFee,
            maxSwapAmount,
            targetChainId
        );

        // Reduce the amount of USDC.X to withdraw by the amount swapped for gas
        uint256 withdrawAmount = usdcXAmount - swappedAmount;

        // Approve the gas token to be spent by the USDC.X contract
        IERC20(gasZRC20).approve(usdcXAddress, gasFee);

        // Withdraw USDC.X to the recipient on the target chain
        IZRC20(usdcXAddress).withdraw(recipient, withdrawAmount);

        // Return any remaining tokens to the user
        uint256 remainingUSDCX = IERC20(usdcXAddress).balanceOf(address(this));
        if (remainingUSDCX > 0) {
            IERC20(usdcXAddress).transfer(msg.sender, remainingUSDCX);
        }

        uint256 remainingGas = IERC20(gasZRC20).balanceOf(address(this));
        if (remainingGas > 0) {
            IERC20(gasZRC20).transfer(msg.sender, remainingGas);
        }
    }

    /**
     * @dev Swaps USDC.X for the required gas token using Uniswap
     * @param usdcXAddress The USDC.X token address
     * @param gasZRC20 The gas token address
     * @param gasFee The amount of gas token needed
     * @param maxSwapAmount Maximum amount of USDC.X to swap
     * @param chainId The target chain ID
     * @return Amount of USDC.X used for the swap
     */
    function swapForGasToken(
        address usdcXAddress,
        address gasZRC20,
        uint256 gasFee,
        uint256 maxSwapAmount,
        uint256 chainId
    ) internal returns (uint256) {
        ISystem system = ISystem(SYSTEM_CONTRACT);
        address router = system.uniswapv2Router02Address();
        address wZeta = system.wZetaContractAddress();

        // Set up the path for the swap
        address[] memory path;

        // Check if we need to go through wZeta (common case)
        if (gasZRC20 != wZeta) {
            path = new address[](3);
            path[0] = usdcXAddress;
            path[1] = wZeta; // Use wZeta as an intermediary
            path[2] = gasZRC20;
        } else {
            path = new address[](2);
            path[0] = usdcXAddress;
            path[1] = gasZRC20;
        }

        // Calculate how much USDC.X we need to swap
        uint[] memory amounts = IUniswapV2Router(router).getAmountsIn(
            gasFee,
            path
        );
        uint256 usdcXRequired = amounts[0];

        require(usdcXRequired <= maxSwapAmount, "Swap exceeds max allowed");

        // Approve the router to spend our USDC.X
        IERC20(usdcXAddress).approve(router, usdcXRequired);

        // Execute the swap
        IUniswapV2Router(router).swapTokensForExactTokens(
            gasFee,
            usdcXRequired,
            path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );

        return usdcXRequired;
    }

    // Helper function to get the correct USDC.X address for a given chain ID
    function getUSDCForChain(uint256 chainId) public view returns (address) {
        return chainToUSDC[chainId];
    }
}
