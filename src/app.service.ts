import { Injectable } from '@nestjs/common';

@Injectable()
    
export class AppService {
  public getHello = (): string => {
    return 'Sniff & Frolic POS API is running';
  };
}