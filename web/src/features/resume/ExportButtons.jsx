// The two downloads every resume offers: a PDF, and a Word file for applications that ask for one.
import { useState } from 'react'
import { Download } from 'lucide-react'
import { RaisedButton } from '../../ui/Button'
import { downloadFile } from './template'

export default function ExportButtons({ fetchFile, name, template, onError }) {
  const [making, setMaking] = useState(null)

  const save = async (format) => {
    setMaking(format)
    try {
      await downloadFile(fetchFile({ format, template }), `${name}.${format}`)
    } catch (e) {
      onError?.(e.message)
    } finally {
      setMaking(null)
    }
  }

  return (
    <div className="row export-buttons">
      <RaisedButton icon={making === 'pdf' ? undefined : Download} busy={making === 'pdf'} disabled={making !== null} onClick={() => save('pdf')}>
        PDF
      </RaisedButton>
      <RaisedButton variant="secondary" busy={making === 'docx'} disabled={making !== null} onClick={() => save('docx')}>
        Word
      </RaisedButton>
    </div>
  )
}
