require('dotenv').config();
const { ethers } = require('ethers');

const RPC = require('./rpc');

const WATCH_ADDRESS = process.env.WATCH_ADDRESS;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const MATIC_BEP20_ADDRESS = '0xcc42724c6683b7e57334c4e856f4c9965ed682bd';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
];

const INFURA_URL = process.env.INFURA_URL;

let lastBalance = 0n;
let rpcIndex = 0;

async function checkMaticOnBSC() {
  // for (let i = 0; i < RPC.length; i++) {
  //   const rpc = RPC[rpcIndex];
  //   rpcIndex = (rpcIndex + 1) % RPC.length;

  try {
    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const token = new ethers.Contract(MATIC_BEP20_ADDRESS, ERC20_ABI, wallet);

    const [balance, decimals] = await Promise.all([
      token.balanceOf(WATCH_ADDRESS),
      token.decimals(),
    ]);

    const humanReadable = ethers.formatUnits(balance, decimals);
    // console.log(`🔍 Using RPC: ${rpc}`);
    console.log(`🔍 MATIC (BEP-20) balance: ${humanReadable}`);

    if (balance > lastBalance) {
      console.log(`🚀 New MATIC received: ${humanReadable}`);

      const min = ethers.parseUnits('1', decimals); // Minimum 0.1 MATIC
      if (balance < min) {
        console.log('⚠️ Balance too low, skipping...');
        return;
      }

      const tx = await token.transfer(DESTINATION_ADDRESS, balance);
      console.log(`✅ Transfer sent: ${tx.hash}`);

      lastBalance = await token.balanceOf(WATCH_ADDRESS);
    } else {
      console.log('⏳ No new MATIC detected.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}
// }

module.exports = checkMaticOnBSC;
