const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const LogStorage = await hre.ethers.getContractFactory("LogStorage");
  const contract = await LogStorage.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("LogStorage deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
