require('dotenv').config();
const { ethers } = require('ethers');
// const checkDOT = require('./checkDOT');

const WATCH_ADDRESS = process.env.WATCH_ADDRESS;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;

let lastBalance = 0n;

const networks = {
  bnb: {
    name: 'Binance Smart Chain',
    rpc: process.env.INFURA_URL,
    minBalance: ethers.parseEther('0.0002'),
  },
  matic: {
    name: 'Polygon',
    rpc: 'https://polygon-rpc.com',
    minBalance: ethers.parseEther('0.0002'),
  },
};

async function checkBalanceAndTransfer(networkKey) {
  try {
    const { rpc, minBalance, name } = networks[networkKey];
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const balance = await provider.getBalance(WATCH_ADDRESS);

    console.log(`🔍 ${name} balance: ${ethers.formatEther(balance)}`);

    if (balance > lastBalance) {
      console.log(`🔍 New BNB detected: ${ethers.formatEther(balance)} ETH`);

      if (balance < minBalance) {
        console.log('⛔ Balance too low to cover estimated gas. Skipping...');
        return;
      }

      // Prepare a dummy transaction to estimate gas
      const txRequest = { to: DESTINATION_ADDRESS, value: balance };

      // Estimate gas limit (should be 21000 for normal ETH transfer)
      const gasLimit = await wallet.estimateGas(txRequest);

      const feeData = await provider.getFeeData();

      let maxFeePerGas = feeData.maxFeePerGas;
      let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      if (!maxFeePerGas) {
        maxFeePerGas = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
        maxPriorityFeePerGas = undefined;
      }

      const txCost = gasLimit * maxFeePerGas;
      const amountToSend = balance - txCost;

      if (amountToSend <= 0n) {
        console.log(`⚠ Not enough ${name} to cover gas.`);
        return;
      }

      const txOptions = {
        to: DESTINATION_ADDRESS,
        value: amountToSend,
        gasLimit,
      };

      if (maxPriorityFeePerGas) {
        txOptions.maxFeePerGas = maxFeePerGas;
        txOptions.maxPriorityFeePerGas = maxPriorityFeePerGas;
      } else {
        txOptions.gasPrice = maxFeePerGas;
      }

      const tx = await wallet.sendTransaction(txOptions);

      console.log(`🚀 Sent ${name} transaction: ${tx.hash}`);
      lastBalance = await provider.getBalance(WATCH_ADDRESS);
    } else {
      console.log(
        `⏳ No new BNB detected. Current balance: ${ethers.formatEther(
          balance
        )} ETH`
      );
    }
  } catch (err) {
    console.error(`❌ Error  on ${networkKey} :`, err.message);
  }
}

setInterval(() => checkBalanceAndTransfer('bnb'), 2000);
setInterval(() => checkBalanceAndTransfer('matic'), 2000);
