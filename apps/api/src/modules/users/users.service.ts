import { Injectable } from '@nestjs/common';

import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  // Public surface kept narrow until features ship.
  getById(id: string) {
    return this.repo.findById(id);
  }
}
