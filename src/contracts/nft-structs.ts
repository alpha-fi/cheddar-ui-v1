export interface NFT {
    token_id: string
    owner_id: string
    metadata: NFTMetadata
    approved_account_ids: object
}

export interface NFTMetadata {
    title: string
    description: string|null
    media: string
    media_hash: string|null
    copies: null
    issued_at: string
    expires_at: string|null
    starts_at: string|null
    updated_at: string|null
    extra: string|null
    reference: string
    reference_hash: string|null
}

export function newNFT(tokenId: string): NFT {
    return {
        token_id: tokenId,
        owner_id: "",
        metadata: {
            title: "",
            description: "",
            media: tokenId + ".png",
            media_hash: "",
            copies: null,
            issued_at: "",
            expires_at: "",
            starts_at: "",
            updated_at: "",
            extra: "",
            reference: "",
            reference_hash: ""
        },
        approved_account_ids: {}
    }
}