import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { configService } from "../config/execution-config.service";
import { getSigningKey, sign } from "../utils/mcl";

export class TaskService {
    private readonly privateKey: string;
    private readonly rpcBaseAddress: string;
    private readonly performerAddress: string;

    constructor() {
        const { privateKey, performerAddress } = configService.config.performer;
        const { rpcBaseAddress } = configService.config;
        this.privateKey = privateKey;
        this.rpcBaseAddress = rpcBaseAddress;
        this.performerAddress = performerAddress;
    }

    async sendTask(proofOfTask: string, data: string, taskDefinitionId: number, targetChainId?: number): Promise<void> {

        const hexData: string = ethers.hexlify(ethers.toUtf8Bytes(data));
        const message: string = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "bytes", "address", "uint16"],
            [proofOfTask, hexData, this.performerAddress, taskDefinitionId]
        );

        const messageHash: string = ethers.keccak256(message);
        const signingKey = getSigningKey(this.privateKey);
        const sig = sign(signingKey, messageHash);
        const sigType = 'bls';

        const provider: JsonRpcProvider = new ethers.JsonRpcProvider(this.rpcBaseAddress);
        const params: any[] = [
            proofOfTask,
            hexData,
            taskDefinitionId,
            this.performerAddress,
            sig,
            sigType,
        ];
    
        if (targetChainId) {
            params.push(targetChainId);
        }
    
        const jsonRpcBody = {
            jsonrpc: "2.0",
            method: "sendTask",
            params,
        };

        try {
            const response = await provider.send(jsonRpcBody.method, jsonRpcBody.params);
            console.log(`Response for chainId ${targetChainId}:`, response);
        } catch (error) {
            console.error(`Error on chainId ${targetChainId}:`, error);
        }
    }
}

export const taskService = new TaskService(); 