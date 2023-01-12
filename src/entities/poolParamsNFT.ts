import { BN } from "bn.js";
import { NFTStakeUnstakeData } from "..";
import { FarmData } from "../config";
import { callMulipleTransactions } from "../contracts/multipleCall";
import { FungibleTokenMetadata } from "../contracts/NEP141";
import { NFTContract } from "../contracts/NFTContract";
import { PoolUserStatusP3NFT } from "../contracts/p3-structures";
import { convertToDecimals } from "../util/conversions";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { DetailRow, RewardsTokenData, TokenIconData } from "./genericData";
import { TokenContractData } from "./PoolEntities";
import { NFTContractData, StakingContractDataNFT } from "./PoolEntitiesNFT";
import { HtmlPoolParams } from "./poolParams";
import {ConfettiButton} from '../util/animations/new-confetti-button';

export class PoolParamsNFT {
    wallet: WalletInterface
    type: string
    html: HtmlPoolParams;
    config: { [key: string]: any }

    poolDescription: string[]|undefined;
    descriptionLink: string[]|undefined;

    stakingContractData: StakingContractDataNFT
    // stakeTokenContractList: TokenContractData[] = [];
    // stakeNFTContractList: NFTContractData[] = [];
    farmTokenContractList: TokenContractData[] = [];

    nftContractForBoosting: NFTContract
    confettiButton?: ConfettiButton

    constructor(wallet: WalletInterface, farmData: FarmData, nftContract: string, nftBaseUrlForBoosting: string) {
        this.wallet = wallet
        this.type = farmData.poolType;

        this.poolDescription = farmData.description;
        this.descriptionLink = farmData.descriptionLink;
        this.config = farmData.config ? farmData.config : []

        this.html = new HtmlPoolParams(farmData.poolName);
        this.stakingContractData = new StakingContractDataNFT(wallet, farmData.contractName, farmData.nftBaseUrl!)

        // console.log("DContract", nftContract)
        this.nftContractForBoosting = new NFTContract(nftContract, nftBaseUrlForBoosting)
        this.nftContractForBoosting.wallet = this.wallet
    }

    async userHasStakedTokens() {
        const poolUserStatus: PoolUserStatusP3NFT = await this.stakingContractData.getUserStatus()
        let hasStakedTokens = false
        for(let i = 0; i < poolUserStatus.stake_tokens.length; i++) {
            hasStakedTokens ||= poolUserStatus.stake_tokens[i].some(token => token.length > 0)
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

    async withdrawBoost(): Promise<any> {
        const poolUserStatus: PoolUserStatusP3NFT = await this.stakingContractData.getUserStatus()
        const tokenId: string = poolUserStatus.boost_nfts.split("@")[1]
        return this.stakingContractData.contract.unstake(this.nftContractForBoosting.contractId, tokenId)
    }

    async transferCheddar() {
        const contractParams = await this.stakingContractData.getContractParams()
        const cheddarContract = (await this.stakingContractData.getStakeTokenContractList())[0].contract!
        const amount = contractParams.cheddar_rate
        const promise = cheddarContract.ft_transfer_call_without_send(
            this.stakingContractData.contract.contractId,
            amount,
            "cheddar stake" // required like this from staking contract
        )

        const promiseWithContract = {
            promise,
            contractName: cheddarContract.contractId
        }

        return promiseWithContract
    }

    transferNFT(stakeNFTContract: NFTContractData, contractId: string, tokenId: string) {
        const promise = stakeNFTContract.contract.nft_transfer_call_without_send(
            this.stakingContractData.contract.contractId,
            tokenId
        )

        const promiseWithContract = {
            promise,
            contractName: contractId
        }
        return promiseWithContract

    }

    async stakeUnstakeNFTs(stakeUnstakeNFTsMap: Map<string, NFTStakeUnstakeData>) {
        let TXs = []
        for(let [contractId, stakeUnstakeNFTs] of stakeUnstakeNFTsMap) {
            const stakeNFTContractList: NFTContractData[] = await this.stakingContractData.getStakeNFTContractList()
            // FIX This implementation is taking into consideration only one stake NFT by pool, but it should be done to consider many
            const stakeNFTContract: NFTContractData = stakeNFTContractList.find(a => a.contract.contractId == contractId)!

            for(let i = 0; i < stakeUnstakeNFTs.nftsToStake.length; i++) {
                TXs.push(await this.transferCheddar())

                const tokenId = stakeUnstakeNFTs.nftsToStake[i]

                TXs.push(this.transferNFT(stakeNFTContract, contractId, tokenId))
            }

            for(let i = 0; i < stakeUnstakeNFTs.nftsToUnstake.length; i++) {
                const tokenId = stakeUnstakeNFTs.nftsToUnstake[i]
                const promise = this.stakingContractData.contract.unstake_without_send(
                    contractId,
                    tokenId
                )

                const promiseWithContract = {
                    promise,
                    contractName: this.stakingContractData.contract.contractId
                }

                TXs.push(promiseWithContract)
            }
        }
        if(TXs.length > 0) await callMulipleTransactions(TXs, this.stakingContractData.contract)   

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