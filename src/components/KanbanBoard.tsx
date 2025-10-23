import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import type { KanbanColumn as KanbanColumnType, Applicant } from '../types';
import KanbanColumn from './KanbanColumn';
import { getKanbanColumns } from '../data/mockData';

const KanbanBoard: React.FC = () => {
  const [columns, setColumns] = useState<KanbanColumnType[]>(getKanbanColumns());

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    // Do nothing if dropped outside a droppable area
    if (!destination) {
      return;
    }

    // Do nothing if dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Find source and destination columns
    const sourceColumn = columns.find(col => col.id === source.droppableId);
    const destColumn = columns.find(col => col.id === destination.droppableId);

    if (!sourceColumn || !destColumn) {
      return;
    }

    // Moving within the same column
    if (sourceColumn === destColumn) {
      const newApplicants = Array.from(sourceColumn.applicants);
      const [removed] = newApplicants.splice(source.index, 1);
      newApplicants.splice(destination.index, 0, removed);

      const newColumn = {
        ...sourceColumn,
        applicants: newApplicants,
      };

      setColumns(columns.map(col => col.id === newColumn.id ? newColumn : col));
    } else {
      // Moving between different columns
      const sourceApplicants = Array.from(sourceColumn.applicants);
      const destApplicants = Array.from(destColumn.applicants);
      const [removed] = sourceApplicants.splice(source.index, 1);

      // Update the applicant's current stage and stage entered time
      const updatedApplicant: Applicant = {
        ...removed,
        currentStage: destination.droppableId,
        stageEnteredAt: new Date(),
      };

      destApplicants.splice(destination.index, 0, updatedApplicant);

      const newSourceColumn = {
        ...sourceColumn,
        applicants: sourceApplicants,
      };

      const newDestColumn = {
        ...destColumn,
        applicants: destApplicants,
      };

      setColumns(columns.map(col => {
        if (col.id === newSourceColumn.id) return newSourceColumn;
        if (col.id === newDestColumn.id) return newDestColumn;
        return col;
      }));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          PSH Housing Application Tracker
        </h1>
        <p className="text-gray-600">
          Track applicants through the housing process - drag cards to update status
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Applicants</h3>
          <p className="text-2xl font-bold text-gray-900">
            {columns.reduce((sum, col) => sum + col.applicants.length, 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
          <p className="text-2xl font-bold text-blue-600">
            {columns.slice(1, -1).reduce((sum, col) => sum + col.applicants.length, 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Overdue</h3>
          <p className="text-2xl font-bold text-red-600">
            {columns.reduce((sum, col) => 
              sum + col.applicants.filter(app => 
                Math.floor((Date.now() - app.stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24)) > 21
              ).length, 0
            )}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Completed</h3>
          <p className="text-2xl font-bold text-green-600">
            {columns[columns.length - 1]?.applicants.length || 0}
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-6">
          {columns.map((column, index) => (
            <KanbanColumn key={column.id} column={column} index={index} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default KanbanBoard;