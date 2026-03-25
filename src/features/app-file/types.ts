export interface CurrentDatabaseInfo {
  path: string;
  file_name: string;
}

export interface MenuActionPayload {
  action: string;
  path: string | null;
}
