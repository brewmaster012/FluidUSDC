```
> USE THIS AT YOUR OWN RISK!!
```


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


<details>
<summary>How does ZRC20 withdraw work? </summary>
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
</details>

<details>
<summary>How does deposit a foreign fungible token into ZetaChain work? </summary>
On a supported foreign chain call the Gateway contract
function (say [Arbitrum Gateway](https://arbiscan.io/address/0x1C53e188Bc2E471f9D4A4762CFf843d32C2C8549#writeProxyContract) the following functions:

```
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

</details>
