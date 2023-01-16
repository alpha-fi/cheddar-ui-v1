import { FarmData } from "../config";
import { callMulipleTransactions } from "../contracts/multipleCall";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { NFTContract } from "../contracts/NFTContract";
import { convertToDecimals } from "../util/conversions";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { DetailRow, RewardsTokenData, TokenIconData } from "./genericData";
import { StakingContractDataP3, TokenContractData } from "./PoolEntities";
import {ConfettiButton} from '../util/animations/new-confetti-button';

//JSON compatible struct returned from get_contract_state
export class HtmlPoolParams {
    id: string;
    formId: string;

    constructor(id: string) {
        this.id = id+"-container";
        this.formId = id;
    }
}

export class PoolUserStatus {
    // All the numbers that are bigint are expected to be without any decimal points, and are converted when needed
    staked: U128String[] = [];
    farmedUnits: U128String = "0";
    farmed: U128String[] = [];
    // computed holds an integer number with no decimal places holding the info about the computed cheddar rewars calculated
    previous_timestamp: number = 0;
    tokenDecimals: Number = 0;
    accName: string = '';
    cheddy_nft: string = '';

    constructor(stakedTokensLength: number, farmedTokensLength: number) {
        this.staked = new Array(stakedTokensLength).fill("0")
        this.farmed = new Array(farmedTokensLength).fill("0")
    }

    

    getDisplayableAccountName() {
        return this.accName.length > 22 ? this.accName.slice(0, 10) + ".." + this.accName.slice(-10) : this.accName
    }

    addStaked(amountArray: bigint[]) {
        for (let i = 0; i < amountArray.length; i++){
            this.staked[i] = (BigInt(this.staked[i]) + amountArray[i]).toString()
        }
    }
}

export class PoolParamsP3 {
    wallet: WalletInterface
    type: string
    html: HtmlPoolParams;
    config: { [key: string]: any }

    poolDescription: string[]|undefined;
    descriptionLink: string[]|undefined;

    stakingContractData: StakingContractDataP3
    stakeTokenContractList: TokenContractData[] = [];
    farmTokenContractList: TokenContractData[] = [];

    nftContractForBoosting: NFTContract
    confettiButton?: ConfettiButton

    constructor(wallet: WalletInterface, farmData: FarmData, nftContract: string, nftBaseUrl: string) {
        this.wallet = wallet
        this.type = farmData.poolType;
        this.config = farmData.config ? farmData.config : []
        
        this.poolDescription = farmData.description;
        this.descriptionLink = farmData.descriptionLink;

        this.html = new HtmlPoolParams(farmData.poolName);
        this.stakingContractData = new StakingContractDataP3(wallet, farmData.contractName)

        this.nftContractForBoosting = new NFTContract(nftContract, nftBaseUrl)
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
        let tokenNames: string[] = []
        const stakeTokenContractList: TokenContractData[] = await this.stakingContractData.getStakeTokenContractList()
        // It was requested that cheddar goes last
        let hasCheddar = false
        let cheddarSymbol: string|undefined
        for(let i = 0; i < stakeTokenContractList.length; i++) {
            const tokenContractData = stakeTokenContractList[i]
            const tokenMetadata = await tokenContractData.getMetadata()
            const isCheddar = tokenMetadata.symbol.toUpperCase() == "CHEDDAR"
            hasCheddar = hasCheddar || isCheddar
            if(!isCheddar) {
                tokenNames.push(tokenMetadata.symbol)
            } else {
                cheddarSymbol = tokenMetadata.symbol
            }
        }
        if(hasCheddar) {
            tokenNames.push(cheddarSymbol!)
        }
        
        const names = tokenNames.join(" + ")
        if(names.length > 20) {
            return names.substring(0, 7) + "..." + names.substring(names.length - 7)
        } else {
            return names
        }
    }

    

    async setAllExtraData() {
    }

    async refreshAllExtraData() {
    }

    async stake(amounts: bigint[]) {
        let TXs = []
        const stakeTokenContractList = await this.stakingContractData.getStakeTokenContractList()
        for(let i = 0; i < stakeTokenContractList.length; i++) {
            const stakeTokenContract = stakeTokenContractList[i].contract!
            if(amounts[i] != 0n) {
                const promise = stakeTokenContract.ft_transfer_call_without_send(
                    this.stakingContractData.contract.contractId, 
                    amounts[i].toString()
                )
                const promiseWithContract = {
                    promise,
                    contractName: stakeTokenContract.contractId
                }

                TXs.push(promiseWithContract)
            }
        }
        await callMulipleTransactions(TXs, this.stakingContractData.contract)   
    }

    async unstake(amounts: bigint[]) {
        let TXs = []
        const stakeTokenContractList = await this.stakingContractData.getStakeTokenContractList()
        for(let i = 0; i < stakeTokenContractList.length; i++) {
            if(amounts[i] != 0n) {
                const stakeContract = stakeTokenContractList[i].contract!
                const promise = stakeContract.unstake_without_send(
                    stakeContract.contractId, 
                    amounts[i].toString()
                )
                const promiseWithContract = {
                    promise,
                    contractName: this.stakingContractData.contract.contractId
                }

                TXs.push(promiseWithContract)
            }
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