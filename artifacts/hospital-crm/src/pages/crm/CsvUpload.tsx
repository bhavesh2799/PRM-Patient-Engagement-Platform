import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet } from "lucide-react";

export default function CsvUpload() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">CSV Bulk Upload</h1>
          <p className="text-muted-foreground mt-1">Import patient leads from offline events or external lists.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Drag and drop your CSV file here</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Ensure your file includes columns for First Name, Last Name, and Mobile Number.
              </p>
              <div className="flex gap-4">
                <Button variant="outline">Download Template</Button>
                <Button>
                  <Upload className="mr-2 w-4 h-4" /> Browse Files
                </Button>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t">
              <h4 className="font-medium mb-4">Upload Instructions</h4>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                <li>Maximum file size is 10MB (approx. 100,000 rows).</li>
                <li>Mobile numbers must include country code (e.g. 91XXXXXXXXXX).</li>
                <li>Duplicate numbers will be merged automatically.</li>
                <li>You can optionally save this upload as a new Audience Segment immediately.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
