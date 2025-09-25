const fs = require('fs');
const path = require('path');

async function main() {
    console.log("Generating deployment documentation for marks/arbitrumSepolia...\n");

    const deploymentDir = path.join(__dirname, '../../deployments/marks/arbitrumSepolia');
    const outputDir = path.join(__dirname, '../../claude_context/deployments');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read all JSON files from deployment directory
    const files = fs.readdirSync(deploymentDir)
        .filter(file => file.endsWith('.json'))
        .filter(file => !file.startsWith('.')) // Exclude hidden files like .migrations.json
        .sort();

    console.log(`Found ${files.length} deployment files\n`);

    // Collect contract information
    const contracts = [];

    for (const file of files) {
        const filePath = path.join(deploymentDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (content.address) {
            const name = file.replace('.json', '');
            contracts.push({
                name,
                address: content.address
            });
        }
    }

    // Generate markdown content
    let markdown = `# Marks Arbitrum Sepolia Deployments\n\n`;
    markdown += `**Network Type:** Testnet  \n`;
    markdown += `**Chain ID:** 421614  \n`;
    markdown += `**Total Contracts:** ${contracts.length}  \n`;
    markdown += `**Last Generated:** ${new Date().toUTCString()}\n\n`;

    // Add deployment purpose
    markdown += `## Deployment Purpose\n\n`;
    markdown += `This deployment is a fork of GMX V2 for the Marks protocol, creating synthetic Nigerian Naira (sNGN) perpetual markets.\n\n`;

    // Add custom tokens section
    markdown += `## Custom Tokens\n\n`;
    markdown += `| Name | Symbol | Address | Decimals | Link |\n`;
    markdown += `|------|--------|---------|----------|------|\n`;
    markdown += `| Test USDT | USDT | \`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6\` | 6 | [View on Explorer](https://sepolia.arbiscan.io/address/0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6) |\n`;
    markdown += `| Synthetic Nigerian Naira | sNGN | \`0xd66e60AA5b6982649a116e6944Daec22b15468Ad\` | 18 | [View on Explorer](https://sepolia.arbiscan.io/address/0xd66e60AA5b6982649a116e6944Daec22b15468Ad) |\n\n`;

    // Add markets section
    markdown += `## Markets\n\n`;
    markdown += `| Market | Index Token | Long Token | Short Token | Market Token | Link |\n`;
    markdown += `|--------|-------------|------------|-------------|--------------|------|\n`;
    markdown += `| Market 1: sNGN [USDT-sNGN] | sNGN | USDT | sNGN | \`0x53b49A28054D108d7050B0E5C317001bE984EB2D\` | [View on Explorer](https://sepolia.arbiscan.io/address/0x53b49A28054D108d7050B0E5C317001bE984EB2D) |\n`;
    markdown += `| Market 2: sNGN [USDT-USDT] | sNGN | USDT | USDT | \`0xb1faf4aFd5bd6aA53CF056BBA31CCa1C44234a24\` | [View on Explorer](https://sepolia.arbiscan.io/address/0xb1faf4aFd5bd6aA53CF056BBA31CCa1C44234a24) |\n\n`;

    // Add core contracts section
    markdown += `## Core Contracts\n\n`;
    markdown += `| Name | Address | Link |\n`;
    markdown += `|------|---------|------|\n`;

    // Define core contracts
    const coreContracts = [
        'DataStore', 'EventEmitter', 'Oracle', 'OracleStore', 'RoleStore',
        'Router', 'ExchangeRouter', 'MarketFactory'
    ];

    for (const contract of contracts) {
        if (coreContracts.includes(contract.name)) {
            markdown += `| ${contract.name} | \`${contract.address}\` | [View on Explorer](https://sepolia.arbiscan.io/address/${contract.address}) |\n`;
        }
    }

    // Add vaults section
    markdown += `\n## Vaults\n\n`;
    markdown += `| Name | Address | Link |\n`;
    markdown += `|------|---------|------|\n`;

    const vaults = contracts.filter(c => c.name.includes('Vault'));
    for (const vault of vaults) {
        markdown += `| ${vault.name} | \`${vault.address}\` | [View on Explorer](https://sepolia.arbiscan.io/address/${vault.address}) |\n`;
    }

    // Add handlers section
    markdown += `\n## Handlers\n\n`;
    markdown += `| Name | Address | Link |\n`;
    markdown += `|------|---------|------|\n`;

    const handlers = contracts.filter(c => c.name.includes('Handler'));
    for (const handler of handlers) {
        markdown += `| ${handler.name} | \`${handler.address}\` | [View on Explorer](https://sepolia.arbiscan.io/address/${handler.address}) |\n`;
    }

    // Add executors section
    markdown += `\n## Order Executors\n\n`;
    markdown += `| Name | Address | Link |\n`;
    markdown += `|------|---------|------|\n`;

    const executors = contracts.filter(c => c.name.includes('Executor'));
    for (const executor of executors) {
        markdown += `| ${executor.name} | \`${executor.address}\` | [View on Explorer](https://sepolia.arbiscan.io/address/${executor.address}) |\n`;
    }

    // Add all remaining contracts
    markdown += `\n## All Deployed Contracts\n\n`;
    markdown += `| Name | Address | Link |\n`;
    markdown += `|------|---------|------|\n`;

    for (const contract of contracts) {
        markdown += `| ${contract.name} | \`${contract.address}\` | [View on Explorer](https://sepolia.arbiscan.io/address/${contract.address}) |\n`;
    }

    // Write the file
    const outputPath = path.join(outputDir, 'marks-arbitrumSepolia-deployments.md');
    fs.writeFileSync(outputPath, markdown);

    console.log(`✅ Documentation generated successfully!`);
    console.log(`📄 Saved to: ${outputPath}`);
    console.log(`\nTotal contracts documented: ${contracts.length}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error generating documentation:", error);
        process.exit(1);
    });