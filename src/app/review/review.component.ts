import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Message, MessagesService, MessageType} from '../messages.service';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.css']
})
export class ReviewComponent implements OnInit {

  constructor(private api: ApiService,
              private route: ActivatedRoute,
              private messagesService: MessagesService,
              private router: Router) {
  }

  ngOnInit() {

    const parent = this;
    this.route.params.subscribe(function (params) {
      parent.api.getEntry(params['entry']).subscribe();
    });
  }

  submitEntry(): void {
    this.api.submitEntry().subscribe(json_data => {
      console.log(json_data);
      this.messagesService.sendMessage(new Message('Submission accepted! Redirecting to home page.',
        MessageType.NotificationMessage, 10000));
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 10000);
    });
  }
}
