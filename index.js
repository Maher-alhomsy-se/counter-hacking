require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const WATCH_ADDRESS = process.env.WATCH_ADDRESS;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;

let lastBalance = 0n;
const MIN_REQUIRED_BALANCE = ethers.parseEther('0.0002'); // 0.0002 ETH

async function checkBalanceAndTransfer() {
  try {
    const balance = await provider.getBalance(WATCH_ADDRESS);

    if (balance > lastBalance) {
      console.log(`🔍 New BNB detected: ${ethers.formatEther(balance)} ETH`);

      if (balance < MIN_REQUIRED_BALANCE) {
        console.log('⛔ Balance too low to cover estimated gas. Skipping...');
        return;
      }

      // Prepare a dummy transaction to estimate gas
      const txRequest = {
        to: DESTINATION_ADDRESS,
        value: balance, // try to send full balance, will subtract gas after
      };

      // Estimate gas limit (should be 21000 for normal ETH transfer)
      const gasLimit = await wallet.estimateGas(txRequest);

      // Get fee data for maxFeePerGas and maxPriorityFeePerGas
      const feeData = await provider.getFeeData();

      let maxFeePerGas = feeData.maxFeePerGas;
      let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      if (!maxFeePerGas) {
        // fallback for legacy networks
        maxFeePerGas = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
        maxPriorityFeePerGas = undefined;
      }

      // Calculate total tx cost = gasLimit * maxFeePerGas
      const txCost = gasLimit * maxFeePerGas;

      // Calculate how much to send after deducting gas cost
      const amountToSend = balance - txCost;

      if (amountToSend <= 0n) {
        console.log('⚠ Not enough ETH to cover gas.');
        return;
      }

      // Build the final transaction
      const txOptions = {
        to: DESTINATION_ADDRESS,
        value: amountToSend,
        gasLimit,
      };

      // Add EIP-1559 fees if available
      if (maxPriorityFeePerGas) {
        txOptions.maxFeePerGas = maxFeePerGas;
        txOptions.maxPriorityFeePerGas = maxPriorityFeePerGas;
      } else {
        // Legacy gas price
        txOptions.gasPrice = maxFeePerGas;
      }

      const tx = await wallet.sendTransaction(txOptions);

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
