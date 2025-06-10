require('dotenv').config();
const { ethers } = require('ethers');
// const RPC = require('./rpc');

const WATCH_ADDRESS = process.env.WATCH_ADDRESS;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const INFURA_URL = process.env.INFURA_URL;

const DOT_BEP20_ADDRESS = '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
];

let lastBalance = 0n;
let rpcIndex = 0;

async function checkDOTOnBSC() {
  // for (let i = 0; i < RPC.length; i++) {
  //   const rpc = RPC[rpcIndex];
  //   rpcIndex = (rpcIndex + 1) % RPC.length;

  try {
    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const token = new ethers.Contract(DOT_BEP20_ADDRESS, ERC20_ABI, wallet);

    const [balance, decimals] = await Promise.all([
      token.balanceOf(WATCH_ADDRESS),
      token.decimals(),
    ]);

    const humanReadable = ethers.formatUnits(balance, decimals);
    // console.log(`🔍 Using RPC: ${rpc}`);
    console.log(`🔍 DOT (BEP-20) balance: ${humanReadable}`);

    if (balance > lastBalance) {
      console.log(`🚀 New DOT received: ${humanReadable}`);

      const min = ethers.parseUnits('1', decimals);
      if (balance < min) {
        console.log('⚠️ Balance too low, skipping...');
        return;
      }

      // Estimate gas cost
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

      // Send DOT
      const tx = await token.transfer(DESTINATION_ADDRESS, balance);
      console.log(`✅ DOT transfer sent: ${tx.hash}`);

      lastBalance = await token.balanceOf(WATCH_ADDRESS);
    } else {
      console.log('⏳ No new DOT detected.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}
// }

module.exports = checkDOTOnBSC;
