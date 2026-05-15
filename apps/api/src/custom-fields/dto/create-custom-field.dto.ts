export class CreateCustomFieldDto {
  name: string;
  entity: 'LEAD' | 'DEAL';
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'CHECKBOX' | 'URL';
  options?: string[];
}
