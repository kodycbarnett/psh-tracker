import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import type { KanbanColumn as KanbanColumnType } from '../types';
import ApplicantCard from './ApplicantCard';

interface KanbanColumnProps {
  column: KanbanColumnType;
  index: number;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column }) => {
  return (
    <div className="bg-gray-100 rounded-lg p-4 min-w-80 h-fit">
      {/* Column Header */}
      <div className="mb-4">
        <h2 className="font-semibold text-gray-800 mb-1">{column.title}</h2>
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>{column.applicants.length} applicant{column.applicants.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-32 transition-colors ${
              snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed rounded-lg' : ''
            }`}
          >
            {column.applicants.map((applicant, index) => (
              <Draggable key={applicant.id} draggableId={applicant.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`${
                      snapshot.isDragging ? 'rotate-2 shadow-lg' : ''
                    } transition-transform`}
                  >
                    <ApplicantCard applicant={applicant} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            
            {/* Empty state */}
            {column.applicants.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center text-gray-400 py-8">
                <p>No applicants in this stage</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default KanbanColumn;