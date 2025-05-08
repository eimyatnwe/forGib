import { DropdownEventArgs, FilterDataSource } from '@gofive/design-system-dropdown'
import {
	Component,
	inject,
	OnDestroy,
	OnInit,
	viewChild,
	ViewChild,
	ViewEncapsulation,
	signal,
	ChangeDetectorRef,
	TemplateRef
} from '@angular/core'
import { Customer, vwUserInfo } from '@venio/shared/models/venio.model'
import { ReportFilter, Summary_Column, Summary_Sales_Order } from '@venio/modules/dashboard/shared/report.model'
import { DatePipe } from '@angular/common'
import { Router } from '@angular/router'
import { DateFormat, PhrasePipe, PhraseService } from '@gofive/angular-common'
import { FieldSettingsModel, FilteringEventArgs } from '@syncfusion/ej2-angular-dropdowns'
import { FreezeService } from '@syncfusion/ej2-angular-grids'
import { DataSharingService } from '@venio/core/data-sharing.service'
import { DependenciesInjector } from '@venio/core/dependencies-injector'
import { FilterSharingService } from '@venio/core/filter-sharing.service'
import { CustomerService } from '@venio/modules/customer/shared/customer.service'
import { AppConfig } from '@venio/shared/classes/config'
import { getDate } from '@venio/shared/helper/dateTime'
import { debounceTime, distinctUntilChanged, Subject, Subscription, switchMap, takeUntil, filter, firstValueFrom } from 'rxjs'
import { Permissions } from '@venio/shared/enum/permissions.enum'
import { Statuses } from '@venio/shared/enum/statuses.enum'
import { ColumnModel } from '@venio/shared/models/datatable.model'
import { SearchFilter, StaffFilter } from '../../../admin/shared/team.model'
import { TeamService } from '../../../admin/shared/team.service'
import { OpportunityManagementService } from '../../../opportunitymanagement/shared/opportunitymanagement.service'
import { MyDropdownComponent } from '../../../shared/my-dropdown/my-dropdown.component'
import { ReportService } from '../../shared/report.service'
import { AppComponent } from '../../../../app.component'
import { CustomerDialogService } from '@venio/modules/customer/shared/services/customer-dialog.service'
import { ReportPDFService } from '@venio/shared/services/report-pdf.service'
import { DateRangeModel } from '@gofive/design-system-calendar/lib/models/datepicker.model'
import { ExportFileType } from '@venio/shared/enum/export-file-type.enum'
import { DateRangeComponent } from './../../../shared/filter/date-range/date-range.component'
import { HistoryLogComponent } from '../../shared/history-log/history-log.component'
import { Go5DropdownFilterEventArgs } from '@venio/shared/interfaces/dropdown.interface'
import {Go5FieldType, Go5TableStandardColumn, Go5TableStandardColumnType, IGo5TableStandardSortEvent, OptionColumnModel} from '@gofive/design-system-table'
import { STATUS_NAME } from '@gofive/design-system-badge'
// import { TableStandardComponent } from '@venio/shared/components/table/table-standard.component'
@Component({
	selector: 'app-sales-order-report',
	templateUrl: './sales-order-report.component.html',
	styleUrls: ['./sales-order-report.component.scss'],
	encapsulation: ViewEncapsulation.None,
	providers: [FreezeService, DatePipe]
})
export class SalesOrderReportComponent implements OnInit, OnDestroy {
	private readonly reportPDFService = inject(ReportPDFService)
	public currentUser: vwUserInfo = new vwUserInfo()
	public canExportReport: boolean = false
	@ViewChild('staff')
	public staffDdl: MyDropdownComponent
	public loading = false
	public counter = Array
	public filter: ReportFilter = new ReportFilter()
	public data: Object[] = []
	public staffs: Object[] = []
	public stfFields: Object = { text: 'fullName', value: 'userId', picture: 'pictureUrl', detail: 'positionName' }
	public teams: Object[] = []
	public teamFields: Object = { text: 'teamName', value: 'teamId' }
	public customers: Customer[] = []
	private readonly customBody = viewChild<TemplateRef<HTMLTableCellElement>>('customBody')
	private readonly customerName = viewChild<TemplateRef<HTMLTableCellElement>>('customerName')
	public customerFields: Object = {
		text: 'customerName',
		value: 'customerId',
		picture: 'pictureUrl',
		status: 'customerStateDisplay'
	}
	public products = []
	public productFields: Object = { text: 'partName', value: 'partId' }
	public statuses: { [key: string]: Object }[] = [
		{
			text: 'common_status_' + Statuses[Statuses.DraftSalesOrder],
			value: Statuses.DraftSalesOrder
		},
		{
			text: 'common_status_' + Statuses[Statuses.SoOpenOrder],
			value: Statuses.SoOpenOrder
		},
		{
			text: 'common_status_' + Statuses[Statuses.DuringPayment],
			value: Statuses.DuringPayment
		},
		{
			text: 'common_status_' + Statuses[Statuses.SoCompletedOrder],
			value: Statuses.SoCompletedOrder
		},
		{
			text: 'common_status_' + Statuses[Statuses.SoRejectOrder],
			value: Statuses.SoRejectOrder
		},
		{
			text: 'common_status_' + Statuses[Statuses.CancelledSalesOrder],
			value: Statuses.CancelledSalesOrder
		}
	]
	public columnsFields: FieldSettingsModel = { text: 'columnName', value: 'columnId' }
	public columnsDdlValue: number[] = []
	public columns: Go5TableStandardColumn[] = []
	ngAfterViewInit() : void{
		this.columns = [
			{
				id: 'saleOrderNo',
				header: {
					text: 'common_docs_no',
					align: 'start',
				},
				sortable: true,
				width: '150px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'saleOrderNo'
				}
			},
			{
				id: 'subject',
				header: {
					text: 'common_case_subject',
					align: 'start',
				},
				sortable: true,
				width: '350px',
				type: Go5TableStandardColumnType.Text,
				topic:{
					fieldName: 'subject'
				}
			},
			{
				id: 'dateCreated',
				header: {
					text: 'common_report_created_date',
					align: 'start',
				},
				sortable: true,
				width: '140px',
				minWidth: '140px',
				type: Go5TableStandardColumnType.Text,
				topic:{
					fieldName: 'dateCreated',
					fieldType: Go5FieldType.Date
				}
			},
			{
				id: 'dateOrder',
				header: {
					text: 'common_report_order_date',
					align: 'start',
				},
				sortable: true,
				width: '160px',
				minWidth: '160px',
				type: Go5TableStandardColumnType.Text,
				topic:{
					fieldName: 'dateOrder',
					fieldType: Go5FieldType.Date
				}
			},
			{
				id: 'customerName',
				header: {
					text: 'common_report_customer_name',
					align: 'start',
				},
				sortable: true,
				width: '230px',
				minWidth: '230px',
				type: Go5TableStandardColumnType.Custom,
				bodyTemplate: this.customerName()
			},
			{
				id: 'contactName',
				header: {
					text: 'common_contact',
				},
				sortable: true,
				width: '180px',
				minWidth: '180px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'contactName',
				}
			},
			{
				id: 'shipToAddress',
				header:{
					text: 'common_shipping_address',
					align: 'start'
				},
				sortable: true,
				width: '200px',
				maxWidth: '200px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'shipToAddress'
				}
			},
			{
				id:'saleOrderDetails',
				header:{
					text: 'common_report_tb_orderdetail',
					align: 'start'
				},
				sortable : false,
				width: '480px',
				minWidth: '480px',
				type: Go5TableStandardColumnType.Custom,
				bodyTemplate: this.customBody()
			},
			{
				id:'totalPrice',
				header:{
					text: 'common_item_price',
				},
				sortable: false,
				width: '160px',
				type: Go5TableStandardColumnType.Money,
				money: {
					fieldName: 'totalPrice',
				},
			},
			{
				id: 'subTotal',
				header: {
					text: 'common_report_tb_subtotal',
					align:'start'
				},
				sortable: true,
				width: '160px',
				minWidth: '160px',
				type: Go5TableStandardColumnType.Money,
				money: {
					fieldName: 'subTotal',
				},
			},
			{
				id: 'discount',
				header: {
					text: 'common_report_tb_discount',
				},
				sortable: true,
				width: '160px',
				minWidth:'160px',
				type: Go5TableStandardColumnType.Money,
				money:{
					fieldName: 'discount',
				}
			},
			{
				id: 'vat',
				header: {
					text: 'common_quotation_vat',
				},
				sortable: true,
				width: '160px',
				type: Go5TableStandardColumnType.Money,
				money:{
					fieldName : 'totalVat',
				}
			},
			{
				id: 'grandTotal',
				header: {
					text: 'common_report_tb_grandtotal',
				},
				sortable: true,
				width: '160px',
				type: Go5TableStandardColumnType.Money,
				money: {
					fieldName: 'grandTotal',
				}
			},
			{
				id: 'approveFullName',
				header: {
					text: 'common_report_completed_by',
				},
				sortable: true,
				width: '160px',
				minWidth: '160px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'approveFullName'
				}
			},
			{
				id: 'dateApproved',
				header:{
					text: 'expense_approved_date'
				},
				sortable: true,
				width:'170px',
				minWidth: '170px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'dateApproved',
					fieldType: Go5FieldType.Date
				}
			},
			{
				id: 'paymentTermDescription',
				header:{
					text: 'common_quotation_payment_term'
				},
				sortable: true,
				width: '170px',
				minWidth: '170px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'paymentTermDescription'
				}
			},
			{
				id: 'remark',
				header: {
					text: 'common_remark'
				},
				sortable: true,
				width: '183px',
				minWidth: '183px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'remark'
				}
			},
			{
				id: 'refNo',
				header: {
					text: 'common_saleorder_ref_no_detail'
				},
				sortable: true,
				width: '160px',
				minWidth: '160px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'refNo'
				}
			},
			{
				id: 'dealNo',
				header: {
					text: 'common_deal_no'
				},
				sortable: true,
				width: '160px',
				minWidth: '160px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'dealNo'
				}
			},
			{
				id: 'orderNo',
				header: {
					text: 'common_quotation_quotation_no',
				},
				sortable: false,
				width: '160px',
				minWidth: '160px',
				type: Go5TableStandardColumnType.Text,
				topic: {
					fieldName: 'orderNo'
				}
			},
			{
				id: 'attachementCount',
				header: {
					text: 'common_total_attachment',
				},
				sortable: true,
				width: '180px',
				minWidth: '180px',
				type: Go5TableStandardColumnType.Text,
				topic:{
					fieldName: 'attachmentCount'
				}
			},
			{
				id: 'privateNote',
				header:{
					text: 'common_activity_private_note',
				},
				sortable: true,
				width: '180px',
				minWidth: '180px',
				type: Go5TableStandardColumnType.Text,
				topic:{
					fieldName: 'privateNote'
				}
			},
			{
				id: 'fullName',
				header:{
					text: 'common_report_staff',
				},
				sortable: true,
				width: '202px',
				type: Go5TableStandardColumnType.Staff,
				staff:{
					fieldName: 'fullName'
				},
				image: {
					fieldName: 'pictureUrl'
				}
			},
			// {
			// 	id: 'status',
			// 	header: {
			// 		text: 'common_report_tb_statusname'
			// 	},
			// 	sortable: true,
			// 	width: '170px',
			// 	type: Go5TableStandardColumnType.Status,
			// 	status: {
			// 		fieldName: 'statusField',
			// 		fieldType: STATUS_NAME.Quotation
			// 	  }
			// }


		]
	}
	public summary: Summary_Sales_Order = null
	public loadingSummary = false
	public pageLength = 20
	public summaryColumm: Summary_Column[] = [
		{ column: 'totalOrder', unit: 'report_sales_order_total_order', type: 'number', line: false },
		{ column: 'completed', unit: 'report_sales_order_completed', type: 'number', line: true },
		{ column: 'pending', unit: 'report_sales_order_pending', type: 'number', line: false },
		{ column: 'bestSeller', unit: 'report_sales_order_best_seller', type: 'topSummary', line: true },
		{
			column: 'topEmployeeUser',
			unit: 'report_sales_order_top_employee',
			type: 'employee',
			line: true,
			value: 'topEmployeeUserId',
			hideIsEmpty: false
		},
		{
			column: 'topCustomer',
			unit: 'report_sales_order_top_customer',
			type: 'customer',
			line: false,
			value: 'topCustomerId'
		},
		{ column: 'totalSales', unit: 'report_sales_order_total_sales', type: 'total', line: true, total: true }
	]
	public btnExport = false
	public filterExport: ReportFilter = new ReportFilter()
	private teams$: Subscription
	private staff$: Subscription
	private OM$: Subscription
	private data$: Subscription
	private summaryObserver$: Subscription
	private currentFilter$: Subscription
	private currentDateFilter$: Subscription
	private scrollHeight = 0

	private readonly destroy$ = new Subject<void>()
	private searchSubject = new Subject<FilteringEventArgs>()
	private readonly debounceTimeMs = 300

	public scrollLoading = signal(false)
	private contentScrollElement: HTMLElement

	public defaultColumns: number[] = []
	public firstSettingColumn = true

	@ViewChild('dateRange')
	public dateRangeComponent: DateRangeComponent
	@ViewChild('dialog')
	dialog: HistoryLogComponent
	public typeCalendar: string
	public typeExportFile: ExportFileType = ExportFileType.SalesOrder
	public date: Date = new Date()
	public dateRang: DateRangeModel = {
		dateFrom: new Date(this.date.getFullYear(), this.date.getMonth(), 1),
		dateTo: new Date(this.date.getFullYear(), this.date.getMonth() + 1, 0)
	}

	public dataSourceFilter: FilterDataSource[] = [
		{
			text: 'common_report_filter_column',
			value: 'column',
			allowFiltering: false,
			fields: this.columnsFields,
			dataSource: this.columns
		},
		{
			text: 'common_status',
			value: 'statusIds',
			allowFiltering: false,
			dataSource: this.statuses
		},
		{
			text: 'common_product_name',
			value: 'products',
			allowFiltering: true,
			fields: this.productFields,
			dataSource: []
		},
		{
			text: 'common_customer',
			value: 'customerIds',
			fields: this.customerFields,
			allowFiltering: true,
			dataSource: []
		},
		{
			text: 'common_team',
			value: 'teamIds',
			fields: this.teamFields,
			allowFiltering: true,
			dataSource: []
		},
		{
			text: 'common_staff',
			value: 'userIds',
			fields: this.stfFields,
			allowFiltering: true,
			dataSource: []
		}
	]

	private readonly phraseService = inject(PhraseService)

	constructor(
		public app: AppComponent,
		public dataShare: DataSharingService,
		private filterSharingService: FilterSharingService,
		private teamService: TeamService,
		private customerService: CustomerService,
		private customerDialogService: CustomerDialogService,
		private OMService: OpportunityManagementService,
		public reportService: ReportService,
		public router: Router,
		public _cdr: ChangeDetectorRef
	) {
		this.currentUser = DependenciesInjector.getCurrentUser()
		if (this.currentUser) {
			if (this.currentUser.permissions.indexOf(Permissions.Reports_Export) > 1) {
				this.canExportReport = true
			}
		}
		this.currentFilter$ = this.filterSharingService.filterSoReport.subscribe((res) => {
			this.filter = res
			if (res.column?.length) {
				this.setActiveColumns(res.column)
			} else {
				this.setDefaultColumn()
			}

			this.scrollHeight = 0
			this.data = []
			this.getDataSummary()
			this.getData()
		})
		this.currentDateFilter$ = this.dataShare.currentSearchReportFilter.subscribe((s) => {
			// this.filter.dateFrom = getDate(s.dateFrom)
			// this.filter.dateTo = getDate(s.dateTo)
			this.filterSharingService.setFilterSoReport(this.filter)
		})
	}

	

	get DateFormat() {
		return DateFormat
	}

	get Statuses() {
		return Statuses
	}

	counters(value) {
		return new Array(value)
	}

	async ngOnInit(): Promise<void> {
		this.getTeamsList()
		this.getStaffList()
		this.getProductList()
		this.loadSetting()
		this.customers = await this.getCustomersList()

		this.searchSubject
			.pipe(
				takeUntil(this.destroy$),
				debounceTime(this.debounceTimeMs),
				distinctUntilChanged(),
				filter(({ text }) => text === '' || text?.length >= 3),
				switchMap(($event) => {
					return this.processInput($event)
				})
			)
			.subscribe(({ res, event }) => {
				event.updateData(res as any)
			})

		this.contentScrollElement = document.querySelector('.dashboard-report-page .content')
		if (this.contentScrollElement) {
			this.onScroll = this.onScroll.bind(this)
			this.contentScrollElement.addEventListener('scroll', this.onScroll)
		}
	}

	private processInput(event: FilteringEventArgs): Promise<{
		res: Customer[]
		event: FilteringEventArgs
	}> {
		return new Promise(async (resolve) => {
			const res = await this.getCustomersList(event?.text ?? '')
			resolve({ res, event })
		})
	}

	public loadSetting() {
		this.currentDateFilter$ = this.dataShare.currentSearchReportFilter.subscribe({
			next: (s) => {
				// this.filter.dateFrom = getDate(s.dateFrom)
				// this.filter.dateTo = getDate(s.dateTo)
				this.filter.orderBy = 'dateCreated desc'
				this.reloadData()
			},
			error: () => {
				const maxDate = new Date()
				const dateRang = { start: new Date(maxDate.getFullYear(), maxDate.getMonth(), 1), end: maxDate }
				this.filter.dateFrom = dateRang?.start
				this.filter.dateTo = dateRang?.end
				this.filter.orderBy = 'dateOrder desc'
				this.dataShare.setSearchReportFilter(this.filter)
			}
		})
	}

	public reloadData() {
		this.scrollHeight = 0
		this.data = []
		this.getDataSummary()
		this.getData()
	}

	ngOnDestroy() {
		this.destroy$.next()
		this.destroy$.complete()

		this.teams$?.unsubscribe()
		this.staff$?.unsubscribe()
		this.OM$?.unsubscribe()
		this.data$?.unsubscribe()
		this.summaryObserver$?.unsubscribe()
		this.currentFilter$?.unsubscribe()
		this.currentDateFilter$?.unsubscribe()
		this.customerDialogService.closeCustomerDetailDialog()

		if (this.contentScrollElement) {
			this.contentScrollElement.removeEventListener('scroll', this.onScroll)
		}
	}

	getData() {
		if (this.loading || !this.filter.dateFrom || !this.filter.dateTo) return
		this.loading = true

		this.filter.start = this.data?.length || 0
		this.filter.pageLength = this.pageLength
		this.data$?.unsubscribe()
		this.data$ = this.reportService.SalesOrderReport(this.filter).subscribe(
			(res) => {
				this.data = this.data.concat(res)
				this.loading = false
				this.scrollLoading.set(false)
				this._cdr.detectChanges()
				AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: res?.httpStatusCode } })
			},
			(err) => {
				this.data = []
				this.loading = false
				this.scrollLoading.set(false)
				this._cdr.detectChanges()
				AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: err?.error?.httpStatusCode } })
			}
		)
	}

	public async exportData() {
		this.btnExport = true
		const columns = [
			{ column: 'saleOrderDetails.partName', columnName: 'common_product_name', isActive: true },
			{ column: 'saleOrderDetails.qty', columnName: 'common_product_qty', isActive: true },
			{ column: 'saleOrderDetails.unit', columnName: 'common_product_unit', isActive: true },
			{ column: 'saleOrderDetails.totalPrice', columnName: 'common_total', isActive: true }
		]
		let columnsExport = []
		this.columns.forEach((c) => {
			columnsExport = columnsExport.concat(c.id === 'saleOrderDetails' ? columns : c)
		})
		let objectExport = null
		this.reportPDFService.exportReport(columnsExport).then((val) => {
			objectExport = val
			this.filterExport = {
				...JSON.parse(JSON.stringify(this.filter)),
				dateFrom: getDate(this.filter.dateFrom),
				dateTo: getDate(this.filter.dateTo)
			}
			this.filterExport.start = 0
			this.filterExport.pageLength = 10000
			this.filterExport.orderColumns = objectExport.orderColumns
			this.reportService.ExportReportSalesOrder(this.filterExport).subscribe(
				(res) => {
					this.reportService.downloadFile(res.body, res.headers)
					this.btnExport = false
				},
				(error) => {
					AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: error?.status } })
				}
			)
		})
	}

	public onSearchFilterByText(event: any) {
		const key = event.value
		const text = event.text || ''

		switch (key) {
			case 'customerIds':
				this.getCustomersList(text).then((customers) => {
					const filterSource = this.dataSourceFilter.find((f) => f.value === key)
					if (filterSource) {
						filterSource.dataSource = customers
					}
				})
				break
			case 'teamIds':
				break
			case 'userIds':
				break
		}
	}

	public openEmp(userId: string) {
		if (!userId) {
			return
		}
		this.router.navigateByUrl('/employee/' + userId)
	}

	public openCustomer(id: number) {
		this.app.openCustomerURL(id)
	}

	public onScroll(e) {
		const element: HTMLElement = e.target
		if (
			!this.scrollLoading() &&
			this.scrollHeight < element?.scrollHeight &&
			element?.offsetHeight + element?.scrollTop + 300 > element?.scrollHeight
		) {
			this.scrollLoading.set(true)
			this.scrollHeight = element?.scrollHeight
			this.getData()
		}
	}

	public sortingBy(event: IGo5TableStandardSortEvent){
		this.columns?.forEach((column) => {
			if(column.id === event.id){
				column['sortType'] = event.sortOrder || 'asc'
			}else{
				column['sortType'] = null
			}
		})

		this.filter.orderBy = `${event.id} ${event.sortOrder?.toLowerCase() || 'asc'}`
		this.reloadData()
	}

	// public onSelectedColumn(value: number[]) {
	// 	this.columns.forEach((s) => (s.isActive = value.findIndex((a) => a === s.id) > -1))
	// }

	public onSelectedTeams(e) {
		this.filter.teamIds = e?.length > 0 ? e : null
		this.getStaffList(this.filter.teamIds)
		this.filter.userIds = null
		this.staffDdl.myDdl.value = null
		this.reloadData()
	}

	getRowSpan(data: any[]) {
		//this.columns
		const detail = this.columns.find((s) => s['id'] === 'dateOrder')
		//original => details.isActive
		if (detail) {
			return data?.length || 1
		}
		return 1
	}

	// getActiveColumn(columnId: number) {
	// 	//this.columns
	// 	return this.columns.find((s) => s['id'] === columnId).isActive
	// }

	private getDataSummary() {
		if (this.loadingSummary || !this.filter.dateFrom || !this.filter.dateTo) return
		this.loadingSummary = true
		this.summary = new Summary_Sales_Order()
		this.summaryObserver$?.unsubscribe()
		this.summaryObserver$ = this.reportService.SummarySalesOrderReport(this.filter).subscribe(
			(res) => {
				this.summary = res
				this.loadingSummary = false
				this.summaryObserver$?.unsubscribe()
				this.summaryObserver$?.remove(this.summaryObserver$)
				this.summaryObserver$ = null
			},
			(error) => {
				console.log(error)
				this.loadingSummary = false
				AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: error?.status } })
			}
		)
	}

	private getTeamsList() {
		this.teams$ = this.teamService.GetDdlTeam(Permissions.SaleOrder).subscribe({
			next: (res) => {
				this.teams = res
				this.setDataSourceFilter('teamIds', res)
				AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: res?.httpStatusCode } })
			},
			error: () => {
				this.teams = []
				this.setDataSourceFilter('teamIds', [])
			}
		})
	}

	private getStaffList(teamIds: number[] = null) {
		this.staff$?.unsubscribe()
		const model: StaffFilter = new StaffFilter()
		model.teamIds = teamIds
		model.take = 100
		model.skip = 0
		model.type = Permissions.SaleOrder
		model.companyIds = this.filter.companyIds || []
		this.staffs = []
		this.staff$ = this.teamService.GetFilterStaff(model).subscribe(
			(res) => {
				this.staffs = res.data
				this.setDataSourceFilter('userIds', res.data)
				this.staff$?.unsubscribe()
				this.staff$?.remove(this.staff$)
				this.staff$ = null
			},
			(err) => {
				console.log(err)
				this.setDataSourceFilter('userIds', [])
				AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: err?.status } })
			}
		)
	}

	private async getCustomersList(text = ''): Promise<Customer[]> {
		try {
			const res = await this.customerService.GetSearchCustomer({
				search: text,
				take: 10000
			})

			this.setDataSourceFilter('customerIds', res)

			return res
		} catch (error: unknown) {
			console.error('Error fetching customers:', error)
			this.customers = []
			this.setDataSourceFilter('customerIds', [])
			if (typeof error === 'object' && 'status' in error && typeof error?.status === 'number') {
				AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: error?.status } })
			}
			return []
		}
	}

	private getProductList() {
		this.OM$ = this.OMService.GetProduct().subscribe(
			(res) => {
				this.products = res.data
				this.setDataSourceFilter('products', res.data)
			},
			(err) => {
				this.products = []
				this.setDataSourceFilter('products', [])
				AppConfig.OPEN_FN.next({ key: 'dialog', value: { httpStatusCode: err?.status } })
			}
		)
	}

	openCustomerDetailDialog(customerId: number, event: MouseEvent) {
		event.stopPropagation()
		this.customerDialogService.openCustomerDetailDialog({ customerId })
	}

	async onCustomerFiltering($event?: FilteringEventArgs): Promise<void> {
		this.searchSubject.next($event)
	}

	public setFilter(date: ReportFilter) {
		this.filter.dateFrom = new Date(date.dateFrom)
		this.filter.dateTo = new Date(date.dateTo)
		this.filter.interval = date.interval
		this.filterSharingService.setFilterSoReport(this.filter)
	}

	public openHistoryLog() {
		this.dialog?.openDialog(this.typeExportFile)
	}

	public onSearch(key: string, value: any[]) {
		this.filter[key] = value?.length > 0 ? value : null
		this.filterSharingService.setFilterSoReport(this.filter)
	}

	public onSelectedFilter(event: DropdownEventArgs) {
		const type: string = event?.data?.value
		const columnIds: number[] = event?.value
		let value = [...new Set(columnIds)]
		this.filter[type] = value

		if (type === 'column') {
			const selectedItems = event?.selectedItems ?? []
			const ids = [...new Set(selectedItems.filter((item) => item.columnId).map((item) => item.columnId))]
			this.setActiveColumns(ids)

			return
		}

		if (type === 'teamIds') {
			this.filter.userIds = []

			this.getStaffList(this.filter.teamIds?.length ? this.filter.teamIds : null)
		}

		this.filterSharingService.setFilterSoReport(this.filter)
		this.reloadData()
	}

	public setDefaultColumn() {
		if (this.firstSettingColumn) {
			this.columns = this.columns?.map((col, index) => {
				// col.columnId = index + 1
				return col
			})

			// const columnIds = this.columns?.filter((c) => c?.isActive)?.map((col) => col?.columnId)
			// this.defaultColumns = columnIds
			// this.filter.column = this.defaultColumns

			this.setDataSourceFilter('column', this.columns)
		}

		if (this.filter?.column?.length) {
			this.setActiveColumns(this.filter?.column)
		}

		this.firstSettingColumn = false
	}

	setActiveColumns(columnsIds = []) {
		this.columns = this.columns?.map((col) => {
			// col.isActive = columnsIds.includes(col.columnId)
			return col
		})
	}

	private setDataSourceFilter(key: string, data: any[]) {
		const filter = this.dataSourceFilter.find((f) => f.value === key)
		if (filter) {
			filter.dataSource = data
		}
		this.dataSourceFilter = [...this.dataSourceFilter]
	}

	public onClearAll(event) {
		this.columns = this.columns?.map((col) => {
			// col.isActive = false
			return col
		})
		this.setActiveColumns([])

		this.dataSourceFilter.forEach((filter) => {
			const key = filter.value
			this.filter[key] = []
		})

		this.getDataSummary()
		this.getData()
	}

	// ถ้า row ไหนที่มีมากกว่า 1 บรรทัดขึ้นไปให้ align-top (เป็น business)
	public cellAlignTop(item: any): boolean {
		const multipleOrderDetails = item.saleOrderDetails?.length > 1
		if (multipleOrderDetails) return true

		const AVG_CHAR_WIDTH = 8

		const textFields = [
			'subject',
			'shipToAddress',
			'remark',
			'privateNote',
			'contactName',
			'customerName',
			'paymentTermDescription'
		]

		//me change
		const wrappedText = textFields.some((field) => {
			const text = item[field]
			if (!text) return false

			const column = this.columns.find((col) => col.id === field)
			if (!column) return false

			const columnWidth = parseInt(column.width)
			const charsPerLine = Math.floor(columnWidth / AVG_CHAR_WIDTH)
			return text.length > charsPerLine
		})

		console.log(wrappedText);

		return wrappedText
	}

	public onFiltering($event: Go5DropdownFilterEventArgs): void {
		const filterType = $event?.value
		const searchText = $event?.text ?? ''
		if (filterType === 'customerIds') {
			this.customerService
				.GetSearchCustomer({
					search: searchText
				})
				.then((res) => {
					this.customers = res

					if ($event.updateData) {
						$event.updateData(res)
					}
				})
				.catch((error) => {
					console.log(error)
					this.customers = []

					if ($event.updateData) {
						$event.updateData([])
					}
				})
		}

		if (filterType === 'userIds') {
			this.teamService
				.GetFilterStaff({
					search: searchText,
					teamIds: this.filter.teamIds,
					skip: 0,
					take: 10000,
					type: Permissions.SaleOrder,
					companyIds: this.filter.companyIds
				})
				.subscribe((res) => {
					this.staffs = res.data

					if ($event.updateData) {
						$event.updateData(res.data)
					}
				})
		}
	}

	public translateKeyInText(text: string) {
		if(typeof text !== 'string'){
			return text
		}

		const regex = /\{([^}]+)\}/
		const match = text?.match(regex)
		if (match) {
			match.forEach((key) => {
				var translated = this.phraseService.translate(key)
				if(translated){
					text = text.replace(`{${key}}`, translated)
				}
			})
		}
	
		return text
	}
}
