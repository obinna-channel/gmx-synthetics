const { ethers } = require("hardhat");

async function main() {
    // Get the EventEmitter contract with proper ABI
    const eventEmitter = await ethers.getContractAt("EventEmitter", "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C");

    console.log("\n=== Checking EventEmitter ABI ===\n");

    // Get EventLog1 from interface
    const eventLog1 = eventEmitter.interface.events["EventLog1(address,string,string,bytes32,(((string,address)[],((string,address[])[])),(((string,uint256)[],((string,uint256[])[])),(((string,int256)[],((string,int256[])[])),(((string,bool)[],((string,bool[])[])),(((string,bytes32)[],((string,bytes32[])[])),(((string,bytes)[],((string,bytes[])[])),(((string,string)[],((string,string[])[]))))))))"];

    if (!eventLog1) {
        console.log("EventLog1 not found with that signature. Let me check what's available:");

        // List all events
        Object.keys(eventEmitter.interface.events).forEach(sig => {
            const event = eventEmitter.interface.events[sig];
            console.log(`\nEvent: ${event.name}`);
            console.log(`Signature: ${sig}`);
            console.log(`Topic: ${eventEmitter.interface.getEventTopic(event)}`);
        });
    } else {
        console.log("Found EventLog1!");
        console.log(`Topic: ${eventEmitter.interface.getEventTopic(eventLog1)}`);
        console.log(`Expected: 0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160`);
    }

    // Try to get any EventLog1
    const eventLog1Alt = eventEmitter.interface.getEvent("EventLog1");
    if (eventLog1Alt) {
        console.log("\n=== Found EventLog1 via getEvent ===");
        console.log(`Name: ${eventLog1Alt.name}`);
        console.log(`Topic: ${eventEmitter.interface.getEventTopic(eventLog1Alt)}`);
        console.log(`Expected: 0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160`);
        console.log(`\nFull signature:`);
        console.log(eventLog1Alt.format());
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
