import { FarmData, NO_CONTRACT_DEPOSIT_NEAR } from "../config";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { convertToDecimals } from "../util/conversions";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { DetailRow, RewardsTokenData, TokenIconData } from "./genericData";
import { StakingContractDataP2, TokenContractData } from "./PoolEntities";
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

export class UserStatusP2 {
    // All the numbers that are bigint are expected to be without any decimal points, and are converted when needed
    real_rewards_per_day: bigint = 0n;
    skip: Number = 0;
    staked: bigint = 0n;
    real: bigint = 0n;
    // computed holds an integer number with no decimal places holding the info about the computed cheddar rewars calculated
    computed: bigint = 0n;
    previous_real: bigint = 0n;
    previousTimestamp: number = 0;
    tokenDecimals: Number = 0;
    accName: string = '';

    constructor(userStatus?: [string, string, string]) {
        if(userStatus) {
            this.staked = BigInt(userStatus[0])
            this.real = BigInt(userStatus[1])
            this.previousTimestamp = Number(userStatus[2])
        }
    }

    hasStakedTokens() {
        return this.staked > 0n
    }

    getDisplayableComputed() {
        return convertToDecimals(this.computed.toString(), 24, 7)
    }

    getCurrentCheddarRewards() {
        return convertToDecimals(this.real.toString(), 24, 7)
    }

    getCurrentDisplayableCheddarRewards() {
        return convertToDecimals(this.computed.toString(), 24, 7)
    }

    getDisplayableAccountName() {
        return this.accName.length > 22 ? this.accName.slice(0, 10) + ".." + this.accName.slice(-10) : this.accName
    }

    addStaked(amount: string) {
        this.staked = this.staked + BigInt(amount)
    }
}

export class PoolParams {
    wallet: WalletInterface
    type: string
    html: HtmlPoolParams;
    config: { [key: string]: any }

    poolDescription: string[]|undefined;
    descriptionLink: string[]|undefined;
    
    stakingContractData: StakingContractDataP2
    poolName: string
    stakeTokenMetaData: FungibleTokenMetadata;
    // Cheddar contract
    cheddarContract: NEP141Trait;
    // Token to be staked contract
    stakeTokenContract: NEP141Trait;
    stakeTokenContractList: TokenContractData[] = [];
    farmTokenContractList: TokenContractData[] = [];

    confettiButton?: ConfettiButton

    constructor(wallet: WalletInterface, farmData: FarmData, cheddarContractId: string) {
        this.wallet = wallet
        this.type = farmData.poolType;
        this.html = new HtmlPoolParams(farmData.poolName)
        this.poolName = farmData.poolName
        this.config = farmData.config ? farmData.config : []

        this.poolDescription = farmData.description;
        this.descriptionLink = farmData.descriptionLink;
        
        this.stakingContractData = new StakingContractDataP2(wallet, farmData.contractName, farmData.tokenContractName, farmData.poolName);
        this.stakingContractData.contract
        
        this.cheddarContract= new NEP141Trait(cheddarContractId);
        this.stakeTokenContract = new NEP141Trait(farmData.tokenContractName)
        this.stakeTokenMetaData = {} as FungibleTokenMetadata;

        this.cheddarContract.wallet = wallet;
        this.stakeTokenContract.wallet = wallet;
    }

    async userHasStakedTokens() {
        const poolUserStatus: UserStatusP2 = await this.stakingContractData.getUserStatus()
        return Number(poolUserStatus.staked) > 0
    }

    async getTokenContractList(tokenContractName: string): Promise<TokenContractData[]> {
        return [new TokenContractData(this.wallet, tokenContractName, this.poolName)]
    }

    async getPoolName() {
        /* Normally, pool names come from metadata, but in case it is requested a particular poolname
        you have to set on config.ts the poolName param starting with _ */
        if(this.poolName[0] === "_") return this.poolName.substring(1)
        const metadata = await this.stakeTokenContractList[0].getMetadata()
        return metadata.symbol
    }

    async setStakeTokenContractList() {
        this.stakeTokenContractList = [await this.getStakeTokenContractData()]
    }

    async setFarmTokenContractList() {
        this.farmTokenContractList = await this.getTokenContractList(this.cheddarContract.contractId)
    }

    async setAllExtraData() {
        await this.setStakeTokenContractList()
        await this.setFarmTokenContractList()
    }

    async refreshAllExtraData() {
        
    }
    
    async getRewardTokenIconData(): Promise<TokenIconData[]> {
        const cheddarMetaData = await this.cheddarContract.ft_metadata()
        const src = cheddarMetaData.icon ? cheddarMetaData.icon : cheddarMetaData.name
        return [{
            isSvg: src.includes("<svg"),
            src: src,
            tokenName: cheddarMetaData.name 
        }]
    }

    async getStakeTokensDetail(): Promise<DetailRow[]>{
        let dataArray: DetailRow[] = []
        
        const stakeTokenContractData: TokenContractData = (await this.stakingContractData.getStakeTokenContractList())[0]
        const iconData = await this.getIcon(stakeTokenContractData)
        const contractParams = await this.stakingContractData.getContractParams()
        const metadata = await stakeTokenContractData.getMetadata()
        const totalStaked = convertToDecimals(contractParams.total_staked, metadata.decimals, 5)

        dataArray.push({
            iconData,
            content: totalStaked
        })
        
        return dataArray
    }

    async getRewardsTokenDetail(): Promise<RewardsTokenData[]> {
        let dataArray: RewardsTokenData[] = []
        const contractParams = await this.stakingContractData.getContractParams()
        const poolUserStatus = await this.stakingContractData.getUserStatus()

        const farmTokenContract = this.farmTokenContractList[0]
        const iconData = await this.getIcon(farmTokenContract)
        const farmTokenMetadata: FungibleTokenMetadata = await farmTokenContract.getMetadata()
        const tokenName = farmTokenMetadata.name
        const rewardsPerDayBN = BigInt(contractParams.farming_rate) * 60n * 24n
        const rewardsPerDay = convertToDecimals(rewardsPerDayBN, farmTokenMetadata.decimals, 7)
        const totalRewards = convertToDecimals(contractParams.total_farmed, farmTokenMetadata.decimals, 7)
        const userUnclaimedRewards = convertToDecimals(poolUserStatus.real.toString(), farmTokenMetadata.decimals, 7)
        
        dataArray.push({
            iconData,
            tokenName,
            rewardsPerDay,
            totalRewards,
            userUnclaimedRewards,
        })
        
        return dataArray
    }

    async getIcon(contractData: TokenContractData): Promise<TokenIconData> {
        const metadata = await contractData.getMetadata()
        const src = metadata.icon ? metadata.icon : metadata.name
        return {
            isSvg: src.includes("<svg"),
            src: src,
            tokenName: metadata.name ? metadata.name : "NoName"
        }
    }

    async getStakeTokenContractData(): Promise<TokenContractData> {
        return new TokenContractData(this.wallet, this.stakeTokenContract.contractId, this.poolName)
    }

    async getFarmTokenContractData(): Promise<TokenContractData> {
        return new TokenContractData(this.wallet, this.cheddarContract.contractId)
    }

    async getWalletAvailable() {
        return await this.stakeTokenContract.ft_balance_of(this.wallet.getAccountId())
    }
}