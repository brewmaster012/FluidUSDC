// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// MessageContext struct from ZetaChain SDK
struct MessageContext {
    bytes sender;
    address senderEVM;
    uint256 chainID;
}

// Universal Contract interface for cross-chain interoperability
interface UniversalContract {
    function onCall(
        MessageContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external;
}

// Interface for the Curve StableSwap pool
interface ICurveStableSwap {
    function add_liquidity(
        uint256[] calldata _amounts,
        uint256 _min_mint_amount,
        address _receiver
    ) external returns (uint256);
}

/**
 * @title USDC4Converter
 * @notice Contract that receives USDC from external chains via depositAndCall
 * and automatically converts it to USDC.4 using the Curve StableSwap pool
 */
contract USDC4Converter is UniversalContract {
    // Addresses from constants
    address public constant USDC_POOL =
        0xCA4b0396064F40640F1d9014257a99aB3336C724; // USDC.4/Curve pool
    address public constant USDC_ARB =
        0x0327f0660525b15Cdb8f1f5FBF0dD7Cd5Ba182aD;
    address public constant USDC_SOL =
        0x8344d6f84d26f998fa070BbEa6D2E15E359e2641;
    address public constant USDC_BASE =
        0x96152E6180E085FA57c7708e18AF8F05e37B479D;
    address public constant USDC_AVAX =
        0xa52Ad01A1d62b408fFe06C2467439251da61E4a9;

    // Map ZRC20 tokens to their index in the Curve pool
    mapping(address => uint8) public zrc20ToIndex;

    // Slippage protection (0.2% default)
    uint256 public slippageTolerance = 20; // Out of 10000 (0.2%)

    constructor() {
        // Initialize token indices for the Curve pool
        zrc20ToIndex[USDC_ARB] = 0;
        zrc20ToIndex[USDC_SOL] = 1;
        zrc20ToIndex[USDC_BASE] = 2;
        zrc20ToIndex[USDC_AVAX] = 3;
    }

    /**
     * @notice Handles cross-chain deposits and converts received ZRC20 to USDC.4
     * @param context Information about the sender and origin chain
     * @param zrc20 The ZRC20 token address that was received (USDC.X)
     * @param amount The amount of ZRC20 tokens received
     * @param message Encoded recipient address that will receive USDC.4
     */
    function onCall(
        MessageContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external override {
        // Verify this is a supported ZRC20 token (USDC from one of our supported chains)
        require(
            zrc20 == USDC_ARB ||
                zrc20 == USDC_SOL ||
                zrc20 == USDC_BASE ||
                zrc20 == USDC_AVAX,
            "Unsupported ZRC20 token"
        );

        // Decode the receiver address from the message
        address receiver = abi.decode(message, (address));
        require(receiver != address(0), "Invalid receiver address");

        // Approve the Curve pool to spend our ZRC20 tokens
        IERC20(zrc20).approve(USDC_POOL, amount);

        // Calculate minimum acceptable amount with slippage protection
        uint256 minMintAmount = (amount * (10000 - slippageTolerance)) / 10000;

        // Create the amounts array for the add_liquidity function
        // All zeros except for the token we're adding
        uint256[] memory amounts = new uint256[](4);
        amounts[zrc20ToIndex[zrc20]] = amount;

        // Add liquidity to the Curve pool to get USDC.4
        ICurveStableSwap(USDC_POOL).add_liquidity(
            amounts,
            minMintAmount,
            receiver
        );

        // The USDC.4 tokens will be sent directly to the receiver
    }

    /**
     * @notice Allows updating the slippage tolerance
     * @param _slippageTolerance New slippage tolerance (in basis points, e.g. 20 = 0.2%)
     */
    function setSlippageTolerance(uint256 _slippageTolerance) external {
        // This should be restricted to admin/owner in production
        require(_slippageTolerance <= 1000, "Slippage too high");
        slippageTolerance = _slippageTolerance;
    }
}
