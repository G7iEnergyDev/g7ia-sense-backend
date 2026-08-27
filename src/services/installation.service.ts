import { InstallationRepository } from '../repositories/installation.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

export class InstallationService {
  constructor(private readonly users = new UserRepository(), private readonly installations = new InstallationRepository()) {}
  async userId(keycloakSub: string) { return this.users.findIdByKeycloakSub(keycloakSub); }
  async listForUser(userId: string) {
    const rows = await this.installations.findAllByOwner(userId);
    return rows.map(({ id, name, created_at, devices }) => ({ id, name, createdAt: created_at, devices }));
  }
  async assertOwnership(installationId: string, userId: string) { return this.installations.belongsToOwner(installationId, userId); }
}
