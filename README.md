```
> USE THIS AT YOUR OWN RISK!!
```
[The App](https://zeta-chain.github.io/FluidUSDC/dist)

# FluidUSDC

USDC on the following networks are currently supported as proof of concept:
- Arbitrum
- Solana
- Base
- Avax

This app has the following cross-chain functinality:
- Start from one of those networks, swap USDC for USDC on another network at low slippage (0.2%).
- Deposit your USDC on any supported chains and get USDC.4 on ZetaChain mainnet
- Redeem your USDC.4 to any USDC on the supported networks.

And the ZetaChain functionalities:
- Convert any USDC.X to USDC.4 on ZetaChain mainnet
- Convert USDC.4 to any USDC.X on the supported networks.

# How it works

On ZetaChain EVM the ZRC20 contract represents a fungible token on a
foregin blockchain (could be gas, ERC20, SPL, or BTC).  Users can
deposit their fungible tokens to a Gateway contract and get the ZRC20
version of it on ZetaChain, or withdraw their ZRC20 balance to the
native chain to an native address. See the [implementation](https://github.com/zeta-chain/protocol-contracts/blob/main/contracts/zevm/ZRC20.sol).


As a result, the same assets such as USDC issued on different networks,
once depsoited into ZetaChain EVM, will be accounted in different ZRC20
contracts, i.e. USDC.ARB, USDC.BASE, USDC.SOL, USDC.AVAX. This [ZetaChain
node API](https://zetachain.blockpi.network/lcd/v1/public/zeta-chain/fungible/foreign_coins) returns all the foreign coins represented as ZRC20 contracts
on zEVM.

This fragmented representations of the same assets (USDC) coming from different
chains complicates the DeFi infrastructure on ZetaChain, resulting in many
more Uniswap or other AMM pools than necessary. To unify the same assets from
different chains, we deploy a [CurveStableSwapNG](https://github.com/curvefi/stableswap-ng/blob/main/contracts/main/CurveStableSwapNG.vy) pool on zEVM for USDC that consists
of the 4 ZRC20 (USDC.ARB/USDC.BASE/USDC.SOL/USDC.AVAX).  User puts USDC.X into the pool
and get USDC.4 as Liquidity provider token (represents shares of the pool) USDC.4 (ERC20).
User can redeem the USDC.4 to any USDC.X, and can optionally withdraw them to chain X using
the withdraw() function of the USDC.X ZRC20 contract.

## How does `CurveStableSwapNG` work
On ZetaChain EVM a `CurveStableSwapNG` pool was created with the following 4 ZRC20
coins:
| Name | Contract Type | Address |
|--------|------|---------|
| AMM Implementation |CurveStableSwapNG impl  | `0x1eD4644Bd2D0e1BBd89d100ba96B1dA48Bf1048f` |
| Factory | CurveStableSwapFactoryNG | `0x4dA267b2F80c74D0FdBcF06f4F65730bB003223E` |
| Pool/USDC.4 |  ERC20/CurveStableSwapNG | `0xCA4b0396064F40640F1d9014257a99aB3336C724` |
| USDC.ARB | ZRC20 | `0x0327f0660525b15Cdb8f1f5FBF0dD7Cd5Ba182aD` |
| USDC.SOL | ZRC20 |`0x8344d6f84d26f998fa070BbEa6D2E15E359e2641` |
| USDC.BASE | ZRC20 |`0x96152E6180E085FA57c7708e18AF8F05e37B479D` |
| USDC.AVAX | ZRC20 |`0xa52Ad01A1d62b408fFe06C2467439251da61E4a9` |
|--------|------|---------|
| USDC4Withdrawer | CCTX IO | `0x3aEA86Ec4ce409C7e01bD4f5D6A175cf9BC7c140` |
| USDC4Deposit | CCTX IO | `0x5D6750637FF2776F9d9B51f11B2eB90D1419A60F` |


You can inspect and interact with these contracts on zetachain blockscout explorer: https://zetachain.blockscout.com

The `CurveStableSwapNG` contract is both a curve pool and also a
ERC20 token, (USDC.4, the liquidity provider token).

### USDC.X ZRC20 -> USDC.4
Since USDC.4 is just the LP token of the `CurveStableSwapNG` pool,
to convert a USDC.X to USDC.4, one simply call one of the `add_liquidity`
functions in the ``CurveStableSwapNG` pool:

```vyper
def add_liquidity(
    _amounts: DynArray[uint256, MAX_COINS],
    _min_mint_amount: uint256,
    _receiver: address = msg.sender
) -> uint256:

```

### USDC.4 -> USDC.Y
To do the inverse, i.e. converting the unified USDC.4 balance into
USDC.Y (the Y need not be the same X that got added into liquidity pool to get the USDC.4), one just burns the USDC.4 balance by removing liquidity from the
`CurveStableSwapNG` pool:
```vyper
def remove_liquidity_one_coin(
    _burn_amount: uint256,
    i: int128,
    _min_received: uint256,
    _receiver: address = msg.sender,
) -> uint256:
```

## USDC.4 on ZetaChain => USDC on chain X

One combines the USDC.4->USDC.X with the `withdraw()` (explained in following sections)  of USDC.X in a contract.

USDC.4 -> (remove_liquidity) -> USDC.X -> (ZRC20 withdraw) -> USDC on chain X

## USDC on chain X => USDC.4 on ZetaChain

One deposit USDC on chain X with depositAndCall (details to be explained in following sections )

USDC on chain X -> (call depositAndCall on chain X Gateway contract) -> (ZRC20 USDC.X, and add it as liquidity to the `CurveStableSwapNG` pool) -> USDC.4 on ZetaChain

## USDC on chain X => USDC on chain Y
Compose the above two:

USDC on chain X => USDC.4 on ZetaChain => USDC on chain Y

## (Detail) How does ZRC20 withdraw work?
ZRC20 contract has a funciton function
```solidity
withdraw(
    bytes memory to,
    uint256 amount
)
```
which will burn the `amount` of the caller balance in this ZRC20 contract,
and release the fungible token this ZRC20 represents to the `to` address
on an external chain.



## (Detail) How does deposit a foreign fungible token into ZetaChain work?
On a supported foreign chain call the Gateway contract
function (say [Arbitrum Gateway](https://arbiscan.io/address/0x1C53e188Bc2E471f9D4A4762CFf843d32C2C8549#writeProxyContract) the following functions:

```solidity
// deposit ETH into ZetaChain
function deposit(
        address receiver,
        RevertOptions calldata revertOptions
    ) external payable whenNotPaused {}

// deposit ERC20 asset into ZetaChain
function deposit(
      address receiver,
      uint256 amount,
      address asset,
      RevertOptions calldata revertOptions
  ) external whenNotPaused {
```

The transaciton will be observeed by ZetaChain observers and corresponding
ZRC20 will be minted to the `receiver` on ZetaChain.

There is a variant of `deposit()` function that allows the deposit into ZRC20
balance, and immediately call a user specified contract on zEVM in the same
transction:

```solidity
function depositAndCall(
    address receiver,
    bytes calldata payload,
    RevertOptions calldata revertOptions
) external payable whenNotPaused {}

function depositAndCall(
    address receiver,
    uint256 amount,
    address asset,
    bytes calldata payload,
    RevertOptions calldata revertOptions
) external whenNotPaused {}
```
The additional parameter `payload` bytes is the contract call after Deposit
into ZRC20 happened. The `receiver` should be a contract on ZetaChain EVM
which will be called with CALLDATA `payload` bytes.
