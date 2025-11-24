const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("LogStorage", function () {
  it("increments id and emits DataLogged", async function () {
    const [user] = await ethers.getSigners();
    const LogStorage = await ethers.getContractFactory("LogStorage");
    const contract = await LogStorage.deploy();
    await contract.waitForDeployment();

    const payload = "hello graph";
    await expect(contract.connect(user).logData(payload))
      .to.emit(contract, "DataLogged")
      .withArgs(user.address, 1n, payload, anyValue);

    const nextId = await contract.nextId();
    expect(nextId).to.equal(1n);
  });
});
