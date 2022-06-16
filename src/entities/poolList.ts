import { nearConfig } from "..";
import { NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { HtmlPoolParams, PoolParams, UserStatusP2 } from "../entities/poolParams";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { PoolParamsP3 } from "./poolParamsP3";


let poolList: Array<PoolParams|PoolParamsP3>;

async function generatePoolList(wallet: WalletInterface) {
    poolList = [];
    let size = nearConfig.farms.length
    for(let i = 0; i < size; i++) {
        const index = nearConfig.farms[i].index as number;
        const type = nearConfig.farms[i].poolType as string;
        const poolHtml = new HtmlPoolParams(nearConfig.farms[i].poolName);
        const cheddarContractName = new NEP141Trait(nearConfig.cheddarContractName);
        const tokenContractName = new NEP141Trait(nearConfig.farms[i].tokenContractName);
        let contract
        let poolParams
        if(nearConfig.farms[i].poolType == "multiple") {
            // contract = new StakingPoolP3(nearConfig.farms[i].contractName);
            // poolParams = new PoolParamsP3(index, type, poolHtml, contract, cheddarContractName, nearConfig.nftContractAddress, wallet);
            poolParams = new PoolParamsP3(wallet, nearConfig.farms[i], nearConfig.nftContractAddress)
        } else {
            contract = new StakingPoolP1(nearConfig.farms[i].contractName);
            poolParams = new PoolParams(wallet, nearConfig.farms[i], nearConfig.cheddarContractName);
        }
        await poolParams.setAllExtraData();

        poolList.push(poolParams);
    }
}

export async function getPoolList(wallet: WalletInterface): Promise<(PoolParams | PoolParamsP3)[]> {
    if(!poolList || poolList.length == 0) {
        await generatePoolList(wallet);
        poolList = await Promise.all(
            poolList.map(async function(pool) {
                pool.stakingContractData.contractParams = await pool.stakingContractData.contractParamsPromise
                return pool
            })
        )
        poolList = poolList.sort((a, b) => b.stakingContractData.contractParams!.farming_end - a.stakingContractData.contractParams!.farming_end)

    }
    return poolList;
}

