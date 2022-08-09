import { BN } from "bn.js";
import { FarmData } from "../config";
import { callMulipleTransactions } from "../contracts/multipleCall";
import { FungibleTokenMetadata } from "../contracts/NEP141";
import { NFTContract } from "../contracts/NFTContract";
import { convertToDecimals } from "../util/conversions";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { DetailRow, RewardsTokenData, TokenIconData } from "./genericData";
import { TokenContractData } from "./PoolEntities";
import { NFTContractData, StakingContractDataNFT } from "./PoolEntitiesNFT";
import { HtmlPoolParams } from "./poolParams";

export class PoolParamsNFT {
    wallet: WalletInterface
    type: string
    html: HtmlPoolParams;

    stakingContractData: StakingContractDataNFT
    // stakeTokenContractList: TokenContractData[] = [];
    stakeNFTContractList: NFTContractData[] = [];
    farmTokenContractList: TokenContractData[] = [];

    nftContractForBoosting: NFTContract

    constructor(wallet: WalletInterface, farmData: FarmData, nftContract: string, nftBaseUrlForBoosting: string) {
        this.wallet = wallet
        this.type = farmData.poolType;

        this.html = new HtmlPoolParams(farmData.poolName);
        this.stakingContractData = new StakingContractDataNFT(wallet, farmData.contractName, farmData.nftBaseUrl!)

        console.log("DContract", nftContract)
        this.nftContractForBoosting = new NFTContract(nftContract, nftBaseUrlForBoosting)
        this.nftContractForBoosting.wallet = this.wallet
    }

    async userHasStakedTokens() {
        const poolUserStatus = await this.stakingContractData.getUserStatus()
        let hasStakedTokens = false
        for(let i = 0; i < poolUserStatus.stake_tokens.length; i++) {
            hasStakedTokens ||= BigInt(poolUserStatus.stake_tokens[i]) > 0n
        }
        return hasStakedTokens
    }

    async getPoolName() {
        return this.html.formId
    }

    

    async setAllExtraData() {
    }

    async refreshAllExtraData() {
    }

    async stakeUnstakeNFTs(toStake: string[], toUnstake: string[]) {
        let TXs = []

        if(toStake.length > 0) {
            const contractParams = await this.stakingContractData.getContractParams()
            // NFT contracts need cheddar stake and it is not thought to have any other type of stake ft
            const cheddarContract = (await this.stakingContractData.getStakeTokenContractList())[0].contract!
            const amount = new BN(contractParams.cheddar_rate).mul(new BN(toStake.length)).toString()
            const promise = cheddarContract.ft_transfer_call_without_send(
                this.stakingContractData.contract.contractId,
                amount,
                "cheddar stake" // required like this from staking contract
            )

            const promiseWithContract = {
                promise,
                contractName: cheddarContract.contractId
            }

            TXs.push(promiseWithContract)
        }
        const stakeNFTContractList: NFTContractData[] = await this.stakingContractData.getStakeNFTContractList()
        // FIX This implementation is taking into consideration only one stake NFT by pool, but it should be done to consider many
        const stakeNFTContract: NFTContractData = stakeNFTContractList[0]

        for(let i = 0; i < toStake.length; i++) {
            const tokenId = toStake[i]
            const promise = stakeNFTContract.contract.nft_transfer_call_without_send(
                this.stakingContractData.contract.contractId,
                tokenId
            )

            const promiseWithContract = {
                promise,
                contractName: stakeNFTContract.contract.contractId
            }

            TXs.push(promiseWithContract)
        }

        for(let i = 0; i < toUnstake.length; i++) {
            const tokenId = toUnstake[i]
            const promise = this.stakingContractData.contract.unstake_without_send(
                stakeNFTContract.contract.contractId,
                tokenId
            )

            const promiseWithContract = {
                promise,
                contractName: stakeNFTContract.contract.contractId
            }

            TXs.push(promiseWithContract)
        }
        await callMulipleTransactions(TXs, this.stakingContractData.contract)   

    }

    async getStakeTokensDetail(): Promise<DetailRow[]>{
        let dataArray: DetailRow[] = []
        const contractParams = await this.stakingContractData.getContractParams()
        const stakeTokenContractList = await this.stakingContractData.getStakeTokenContractList()

        for(let i = 0; i < stakeTokenContractList.length; i++) {
            const stakeTokenContract = stakeTokenContractList[i]
            const iconData = await this.getIcon(stakeTokenContract)
            const stakeTokenMetadata = await stakeTokenContract.getMetadata()
            const totalStaked = convertToDecimals(contractParams.total_staked[i], stakeTokenMetadata.decimals, 5)

            dataArray.push({
                iconData,
                content: totalStaked
            })
        }
        return dataArray
    }

    async getRewardsTokenDetail(): Promise<RewardsTokenData[]> {
        let dataArray: RewardsTokenData[] = []
        const contractParams = await this.stakingContractData.getContractParams()
        const poolUserStatus = await this.stakingContractData.getUserStatus()
        const farmTokenContractList = await this.stakingContractData.getFarmTokenContractList()

        for(let i = 0; i < farmTokenContractList.length; i++) {
            const farmTokenContract = farmTokenContractList[i]
            const iconData = await this.getIcon(farmTokenContract)
            const farmTokenMetadata: FungibleTokenMetadata = await farmTokenContract.getMetadata()
            const tokenName = farmTokenMetadata.name
            // const rewardsPerDayBN = BigInt(contractParams.farm_token_rates[i]) * 60n * 24n
            const rewardsPerDayBN = BigInt(contractParams.farm_unit_emission) * BigInt(contractParams.farm_token_rates[i]) * 60n * 24n / (BigInt(10) ** BigInt(24))
            const rewardsPerDay = convertToDecimals(rewardsPerDayBN, farmTokenMetadata.decimals, 5)
            const totalRewards = convertToDecimals(contractParams.total_farmed[i], farmTokenMetadata.decimals, 5)
            const userUnclaimedRewards = convertToDecimals(poolUserStatus.farmed_tokens[i], farmTokenMetadata.decimals, 5)

            dataArray.push({
                iconData,
                tokenName,
                rewardsPerDayBN,
                rewardsPerDay,
                totalRewards,
                userUnclaimedRewards,
            })
        }
        return dataArray
    }

    async getIcon(contractData: TokenContractData): Promise<TokenIconData>{
        const metadata = await contractData.getMetadata()
        const src = metadata.icon ? metadata.icon : metadata.name
        return {
            isSvg: src.includes("<svg"),
            src: src,
            tokenName: metadata.name ? metadata.name : "NoName"
        }
    }

    async getRewardTokenIconData(): Promise<TokenIconData[]> {
        let dataArray: TokenIconData[] = []
        const farmTokenContractList = await this.stakingContractData.getFarmTokenContractList()
        for(let i = 0; i < farmTokenContractList.length; i++) {
            const farmTokenContract = farmTokenContractList[i]
            const farmTokenMetadata = await farmTokenContract.getMetadata()
            const src = farmTokenMetadata.icon ? farmTokenMetadata.icon : farmTokenMetadata.name
            const data = {
                isSvg: src.includes("<svg"),
                src: src,
                tokenName: farmTokenMetadata.name ? farmTokenMetadata.name : "NoName"
            }
            dataArray.push(data)
        }
        return dataArray
        
    }

    async getWalletAvailable(): Promise<U128String[]> {
        let walletAvailable: U128String[] = []
        const stakeTokenContractList = await this.stakingContractData.getStakeTokenContractList()
        for(let i = 0; i < stakeTokenContractList.length; i++) {
            const contractData = stakeTokenContractList[i]
            const balance = await contractData.getBalance()
            walletAvailable.push(balance)
        }
        return walletAvailable
    }
}