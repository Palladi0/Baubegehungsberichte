'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import BerichtsAbschnitt from './BerichtsAbschnitt'
import type { AbschnittInBericht } from '@/types/berichte'

interface Props {
  abschnitte: AbschnittInBericht[]
  onChange: (updated: AbschnittInBericht[]) => void
}

export default function AbschnittListe({ abschnitte, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const altIdx = abschnitte.findIndex((a) => a.begehungs_id === active.id)
    const neuIdx = abschnitte.findIndex((a) => a.begehungs_id === over.id)

    const neueSortierung = arrayMove(abschnitte, altIdx, neuIdx).map((a, idx) => ({
      ...a,
      reihenfolge: idx,
    }))

    onChange(neueSortierung)
  }

  function updateAbschnitt(updated: AbschnittInBericht) {
    onChange(abschnitte.map((a) => (a.begehungs_id === updated.begehungs_id ? updated : a)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={abschnitte.map((a) => a.begehungs_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {abschnitte.map((abschnitt) => (
            <BerichtsAbschnitt
              key={abschnitt.begehungs_id}
              abschnitt={abschnitt}
              onChange={updateAbschnitt}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
