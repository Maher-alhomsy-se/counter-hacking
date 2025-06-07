require('dotenv').config();
const { ethers } = require('ethers');
const RPC = require('./rpc');

const WATCH_ADDRESS = process.env.WATCH_ADDRESS;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const ADA_BEP20_ADDRESS = '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
];

let lastBalance = 0n;
let rpcIndex = 0;

async function checkADAOnBSC() {
  for (let i = 0; i < RPC.length; i++) {
    const rpc = RPC[rpcIndex];
    rpcIndex = (rpcIndex + 1) % RPC.length;

    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      const token = new ethers.Contract(ADA_BEP20_ADDRESS, ERC20_ABI, wallet);

      const [balance, decimals] = await Promise.all([
        token.balanceOf(WATCH_ADDRESS),
        token.decimals(),
      ]);

      const humanReadable = ethers.formatUnits(balance, decimals);
      console.log(`🔍 Using RPC: ${rpc}`);
      console.log(`🔍 ADA (BEP-20) balance: ${humanReadable}`);

      if (balance > lastBalance) {
        console.log(`🚀 New ADA received: ${humanReadable}`);

        const min = ethers.parseUnits('0.002', decimals);
        if (balance < min) {
          console.log('⚠️ Balance too low, skipping...');
          return;
        }

        const gasEstimate = await token.estimateGas.transfer(
          DESTINATION_ADDRESS,
          balance
        );
        const gasPrice = await provider.getGasPrice();
        const bnbBalance = await provider.getBalance(WATCH_ADDRESS);
        const gasCost = gasEstimate * gasPrice;

        if (bnbBalance < gasCost) {
          console.log(
            `❌ Not enough BNB to cover gas. Need at least: ${ethers.formatEther(
              gasCost
            )} BNB`
          );
          return;
        }

        const tx = await token.transfer(DESTINATION_ADDRESS, balance);
        console.log(`✅ ADA transfer sent: ${tx.hash}`);

        lastBalance = await token.balanceOf(WATCH_ADDRESS);
      } else {
        console.log('⏳ No new ADA detected.');
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }
}

module.exports = checkADAOnBSC;
