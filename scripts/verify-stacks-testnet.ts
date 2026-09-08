import { getStacksTestnetStatus } from "../server/providers/stacksTestnet";

const status = await getStacksTestnetStatus(process.env);
console.log(JSON.stringify(status, null, 2));
if (!status.contracts?.sbtc.deployed) process.exitCode = 1;
