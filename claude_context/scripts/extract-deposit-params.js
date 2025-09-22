const fs = require('fs');
const deploymentData = JSON.parse(fs.readFileSync('deployments/marks/arbitrumSepolia/ExchangeRouter.json'));

const createDepositFunc = deploymentData.abi.find(item => 
    item.type === 'function' && item.name === 'createDeposit'
);

console.log("createDeposit function parameters:");
console.log(JSON.stringify(createDepositFunc.inputs, null, 2));
