import * as crud from './program/crud';
import * as weeks from './program/weeks';
import * as targets from './program/targets';
import * as progression from './progression';
import * as dashboard from './program/dashboard';

export const ProgramService = {
  ...crud,
  ...weeks,
  ...targets,
  getDoubleProgressionStatus: progression.getDoubleProgressionStatus,
  ...dashboard,
};
