import { WITHDRAW } from "./config";

/**
 * Format EIP-712 du bon de retrait signé par le serveur et vérifié par le contrat
 * `FrontierVault`. Le même schéma est codé en Solidity (WITHDRAW_TYPEHASH).
 */
export const VAULT_DOMAIN_NAME = "FrontierVault";
export const VAULT_DOMAIN_VERSION = "1";

export const WITHDRAW_TYPES = {
  Withdraw: [
    { name: "colonyId", type: "uint256" },
    { name: "player", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** $HALO hors chaîne (2 décimales) vers unités du token ERC-20 (18 décimales). */
export function haloToWei(halo: number): bigint {
  return BigInt(Math.round(halo * 100)) * 10n ** 16n;
}
export function weiToHalo(wei: bigint): number {
  return Number(wei / 10n ** 16n) / 100;
}

/** Frais de retrait (brûlés par le contrat) pour un montant donné, en $HALO. */
export function withdrawFee(halo: number): number {
  return Math.round(halo * WITHDRAW.feeBps) / 10000;
}
