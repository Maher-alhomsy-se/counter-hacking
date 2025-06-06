require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const WATCH_ADDRESS = process.env.WATCH_ADDRESS;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;

let lastBalance = 0n;
const MIN_REQUIRED_BALANCE = ethers.parseEther('0.002'); // 0.002 ETH

async function checkBalanceAndTransfer() {
  try {
    const balance = await provider.getBalance(WATCH_ADDRESS);

    if (balance > lastBalance) {
      console.log(`🔍 New BNB detected: ${ethers.formatEther(balance)} ETH`);

      if (balance < MIN_REQUIRED_BALANCE) {
        console.log('⛔ Balance too low to cover estimated gas. Skipping...');
        return;
      }

      const feeData = await provider.getFeeData();

      const gasLimit = 21000n;
      const gasPrice = feeData.maxFeePerGas || ethers.parseUnits('30', 'gwei');
      const priorityFee =
        feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

      const txCost = gasLimit * gasPrice;
      const amountToSend = balance - txCost;

      if (amountToSend <= 0n) {
        console.log('⚠ Not enough ETH to cover gas.');
        return;
      }

      const tx = await wallet.sendTransaction({
        to: DESTINATION_ADDRESS,
        value: amountToSend,
        gasLimit,
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: priorityFee,
      });

      console.log(`🚀 Sent transaction: ${tx.hash}`);
      lastBalance = await provider.getBalance(WATCH_ADDRESS);
    } else {
      console.log(
        `⏳ No new BNB detected. Current balance: ${ethers.formatEther(
          balance
        )} ETH`
      );
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

setInterval(checkBalanceAndTransfer, 2000);
