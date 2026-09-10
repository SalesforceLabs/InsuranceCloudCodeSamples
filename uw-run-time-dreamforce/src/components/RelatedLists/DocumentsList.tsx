import React from 'react';
import { Card, DataTable, DataTableColumn, Icon } from '@salesforce/design-system-react';
import { RelatedDocument } from '@/types/InsuranceSubmission';
import { format } from 'date-fns';

interface DocumentsListProps {
  documents: RelatedDocument[];
}

export default function DocumentsList({ documents }: DocumentsListProps) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MM/dd/yyyy hh:mm a');
  };

  const columns: DataTableColumn[] = [
    {
      label: 'Document Name',
      property: 'name',
      sortable: true,
    },
    {
      label: 'Type',
      property: 'type',
      sortable: true,
    },
    {
      label: 'Size',
      property: 'size',
      sortable: true,
    },
    {
      label: 'Upload Date',
      property: 'uploadDate',
      sortable: true,
    },
    {
      label: 'Uploaded By',
      property: 'uploadedBy',
      sortable: true,
    },
  ];

  const items = documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    size: doc.size,
    uploadDate: formatDate(doc.uploadDate),
    uploadedBy: doc.uploadedBy,
  }));

  return (
    <Card
      heading={`Documents (${documents.length})`}
      headerActions={
        <button className="slds-button slds-button_neutral">
          <Icon
            category="utility"
            name="upload"
            size="x-small"
            className="slds-button__icon slds-button__icon_left"
          />
          Upload Files
        </button>
      }
      className="slds-m-top_medium"
    >
      <DataTable
        items={items}
        id="documents-table"
        fixedLayout
        columnBordered
      >
        {columns.map((column) => (
          <DataTableColumn key={column.property} {...column} />
        ))}
      </DataTable>
    </Card>
  );
}
