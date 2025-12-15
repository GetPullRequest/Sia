import { EncryptedSecret } from './encrypted-secret.js';
import { GCPSecretManager } from './gcp-secret-manager.js';
import type { SecretManager } from './secret-manager.js';

export type SecretStorageType = 'gcp' | 'encrypted_local';

export class SecretStorageService {
  private secretManager: SecretManager;
  private storageType: SecretStorageType;

  constructor() {
    const storageTypeEnv = process.env.SECRET_STORAGE_TYPE?.toLowerCase();
    if (storageTypeEnv === 'gcp') {
      this.storageType = 'gcp';
      this.secretManager = new GCPSecretManager();
    } else {
      this.storageType = 'encrypted_local';
      this.secretManager = new EncryptedSecret();
    }
  }

  getStorageType(): SecretStorageType {
    return this.storageType;
  }

  async storeSecret(
    secretId: string,
    plaintext: string
  ): Promise<{ storedValue: string; storageType: SecretStorageType }> {
    const storedValue = await this.secretManager.storeSecret(
      secretId,
      plaintext
    );
    return {
      storedValue,
      storageType: this.storageType,
    };
  }

  async retrieveSecret(
    secretId: string,
    storageType: SecretStorageType
  ): Promise<string> {
    // Create the appropriate secret manager based on storage type
    let manager: SecretManager;

    if (storageType === 'gcp') {
      manager = new GCPSecretManager();
    } else {
      manager = new EncryptedSecret();
    }

    return manager.retrieveSecret(secretId);
  }

  async deleteSecret(
    secretId: string,
    storageType: SecretStorageType
  ): Promise<void> {
    let manager: SecretManager;

    if (storageType === 'gcp') {
      manager = new GCPSecretManager();
    } else {
      manager = new EncryptedSecret();
    }

    await manager.deleteSecret(secretId);
  }
}
